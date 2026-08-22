"""
Native ZKFinger C SDK bindings via ctypes.

Linux:  libzkfp.so from resources/sdk/SDK/lib-x64
Windows: libzkfp.dll from resources/sdk/windows (or ZKFP_LIB_DIR)

Supports full tear-down + reopen when the USB device is replugged or moves ports.
"""

from __future__ import annotations

import ctypes
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger('zkfinger_service')

MAX_TEMPLATE_SIZE = 2048
ZKFP_ERR_OK = 0
ZKFP_ERR_CAPTURE = -8  # no finger present — poll again
ZKFP_ERR_LIB_INIT = -2  # capture library init failed (stale state / USB race)

_IS_WINDOWS = sys.platform.startswith('win')

_PRELOAD_ORDER_LINUX = (
    "libusb-0.1.so.4",
    "libsqlite3.so.0",
    "libcrypto.so.0.9.8",
    "libiomp5.so",
    "libidkit.so.2",
    "libzkfinger10.so",
    "libsilkidcap.so",
    "libzkfp.so",
)

# Typical ZKFinger Windows SDK DLL names (order matters for dependency preload)
_PRELOAD_ORDER_WINDOWS = (
    "libusb-1.0.dll",
    "sqlite3.dll",
    "libiomp5md.dll",
    "zkfinger10.dll",
    "libzkfp.dll",
)


def _core_lib_name() -> str:
    return "libzkfp.dll" if _IS_WINDOWS else "libzkfp.so"


def default_sdk_lib_dir() -> Path:
    env = os.environ.get("ZKFP_LIB_DIR")
    if env:
        return Path(env)

    here = Path(__file__).resolve().parent
    repo = here.parent
    if _IS_WINDOWS:
        return repo / "resources" / "sdk" / "windows"
    return repo / "resources" / "sdk" / "SDK" / "lib-x64"


def ensure_library_path(lib_dir: Optional[Path] = None) -> Path:
    """Add SDK lib dir to the loader search path and preload shared objects."""
    lib_dir = Path(lib_dir) if lib_dir else default_sdk_lib_dir()
    if not lib_dir.is_dir():
        raise FileNotFoundError(f"ZKFinger SDK lib directory not found: {lib_dir}")

    lib_dir_str = str(lib_dir)
    if _IS_WINDOWS:
        # Python 3.8+ on Windows needs add_dll_directory for dependent DLLs
        if hasattr(os, "add_dll_directory"):
            os.add_dll_directory(lib_dir_str)
        os.environ["PATH"] = f"{lib_dir_str}{os.pathsep}{os.environ.get('PATH', '')}"
        preload = _PRELOAD_ORDER_WINDOWS
        load = ctypes.WinDLL
    else:
        current = os.environ.get("LD_LIBRARY_PATH", "")
        if lib_dir_str not in current.split(":"):
            os.environ["LD_LIBRARY_PATH"] = (
                f"{lib_dir_str}:{current}" if current else lib_dir_str
            )
        preload = _PRELOAD_ORDER_LINUX
        load = lambda p: ctypes.CDLL(p, mode=ctypes.RTLD_GLOBAL)  # noqa: E731

    core = _core_lib_name()
    for name in preload:
        path = lib_dir / name
        if not path.exists():
            if name == core:
                raise FileNotFoundError(f"Missing required library: {path}")
            logger.warning(f"Optional SDK lib missing: {path}")
            continue
        load(str(path))

    return lib_dir


class NativeZKFP:
    """Thin wrapper around ZKFPM_* C API with reconnect support."""

    def __init__(self, lib_dir: Optional[Path] = None):
        self.lib_dir = ensure_library_path(lib_dir)
        core_path = self.lib_dir / _core_lib_name()
        if _IS_WINDOWS:
            self._lib = ctypes.WinDLL(str(core_path))
        else:
            self._lib = ctypes.CDLL(str(core_path))
        self._setup_prototypes()
        self.dev_handle = None
        self.db_handle = None
        self.width = 0
        self.height = 0
        self._img_buf = None
        self._sdk_initialized = False
        self.device_index = 0

    def _setup_prototypes(self) -> None:
        L = self._lib
        L.ZKFPM_Init.restype = ctypes.c_int
        L.ZKFPM_Terminate.restype = ctypes.c_int
        L.ZKFPM_GetDeviceCount.restype = ctypes.c_int

        L.ZKFPM_OpenDevice.argtypes = [ctypes.c_int]
        L.ZKFPM_OpenDevice.restype = ctypes.c_void_p

        L.ZKFPM_CloseDevice.argtypes = [ctypes.c_void_p]
        L.ZKFPM_CloseDevice.restype = ctypes.c_int

        L.ZKFPM_GetParameters.argtypes = [
            ctypes.c_void_p, ctypes.c_int,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.POINTER(ctypes.c_uint),
        ]
        L.ZKFPM_GetParameters.restype = ctypes.c_int

        L.ZKFPM_AcquireFingerprint.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.c_uint,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.POINTER(ctypes.c_uint),
        ]
        L.ZKFPM_AcquireFingerprint.restype = ctypes.c_int

        L.ZKFPM_DBInit.restype = ctypes.c_void_p
        L.ZKFPM_DBFree.argtypes = [ctypes.c_void_p]
        L.ZKFPM_DBFree.restype = ctypes.c_int

        L.ZKFPM_DBMerge.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_ubyte),
            ctypes.POINTER(ctypes.c_ubyte),
            ctypes.POINTER(ctypes.c_ubyte),
            ctypes.POINTER(ctypes.c_ubyte),
            ctypes.POINTER(ctypes.c_uint),
        ]
        L.ZKFPM_DBMerge.restype = ctypes.c_int

        L.ZKFPM_DBMatch.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.c_uint,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.c_uint,
        ]
        L.ZKFPM_DBMatch.restype = ctypes.c_int

    def init(self, retries: int = 3) -> None:
        """Initialize SDK. Retries after Terminate when Init returns -2 (stale USB state)."""
        last_err = None
        for attempt in range(1, retries + 1):
            # Always clear previous SDK state first
            self._soft_terminate()
            time.sleep(0.15 * attempt)

            ret = self._lib.ZKFPM_Init()
            if ret == ZKFP_ERR_OK:
                self._sdk_initialized = True
                logger.info(f"ZKFPM_Init OK (attempt {attempt})")
                return

            last_err = ret
            logger.warning(f"ZKFPM_Init returned {ret} (attempt {attempt}/{retries})")
            if ret == ZKFP_ERR_LIB_INIT:
                self._soft_terminate()
                time.sleep(0.4)
                continue

        raise RuntimeError(f"ZKFPM_Init failed after {retries} attempts: {last_err}")

    def _soft_terminate(self) -> None:
        """Best-effort close handles and terminate SDK without raising."""
        try:
            if self.db_handle:
                self._lib.ZKFPM_DBFree(self.db_handle)
        except Exception:
            pass
        self.db_handle = None

        try:
            if self.dev_handle:
                self._lib.ZKFPM_CloseDevice(self.dev_handle)
        except Exception:
            pass
        self.dev_handle = None
        self._img_buf = None

        try:
            self._lib.ZKFPM_Terminate()
        except Exception:
            pass
        self._sdk_initialized = False

    def terminate(self) -> None:
        try:
            self._soft_terminate()
        except Exception as e:
            logger.error(f"Native ZKFP terminate error: {e}")

    def get_device_count(self) -> int:
        if not self._sdk_initialized:
            return 0
        try:
            return int(self._lib.ZKFPM_GetDeviceCount())
        except Exception:
            return 0

    def open_device(self, index: int = 0) -> None:
        if not self._sdk_initialized:
            raise RuntimeError("SDK not initialized — call init() first")

        self.device_index = index
        handle = self._lib.ZKFPM_OpenDevice(index)
        if not handle:
            raise RuntimeError(f"ZKFPM_OpenDevice({index}) failed")
        self.dev_handle = handle

        self.width = self._get_int_param(1)
        self.height = self._get_int_param(2)
        if self.width <= 0 or self.height <= 0:
            self.width, self.height = 256, 360
            logger.warning(
                f"Could not read image size; using {self.width}x{self.height}"
            )

        img_size = self.width * self.height
        self._img_buf = (ctypes.c_ubyte * img_size)()

        self.db_handle = self._lib.ZKFPM_DBInit()
        if not self.db_handle:
            raise RuntimeError("ZKFPM_DBInit failed")

        logger.info(
            f"Opened ZKFinger device {index} "
            f"(image {self.width}x{self.height})"
        )

    def reconnect(self, index: int = 0) -> None:
        """Full tear-down and reopen — use after USB unplug/replug or port change."""
        logger.info("Reconnecting ZKFinger SDK (terminate → init → open) …")
        self.terminate()
        time.sleep(0.35)
        self.init()
        count = self.get_device_count()
        if count < 1:
            raise RuntimeError("No ZKTeco device found after reconnect")
        self.open_device(min(index, count - 1))

    def is_open(self) -> bool:
        return bool(self._sdk_initialized and self.dev_handle and self.db_handle)

    def health_check(self) -> bool:
        """Return True if SDK still sees at least one device and handles look valid."""
        if not self.is_open():
            return False
        try:
            return self.get_device_count() >= 1
        except Exception:
            return False

    def _get_int_param(self, code: int) -> int:
        buf = (ctypes.c_ubyte * 4)()
        size = ctypes.c_uint(4)
        ret = self._lib.ZKFPM_GetParameters(
            self.dev_handle, code, buf, ctypes.byref(size)
        )
        if ret != ZKFP_ERR_OK:
            return 0
        return int.from_bytes(bytes(buf[:4]), byteorder="little", signed=True)

    def acquire_fingerprint(
        self,
        timeout_sec: float = 30.0,
        poll_interval: float = 0.1,
        require_lift_after: bool = True,
        lift_timeout_sec: float = 20.0,
    ) -> Tuple[bytes, bytes]:
        if not self.dev_handle or self._img_buf is None:
            raise RuntimeError("Device not opened")

        # If the previous scan left a finger on the sensor, wait for lift first.
        self._wait_for_finger_lift(timeout_sec=min(8.0, lift_timeout_sec), poll_interval=poll_interval)

        deadline = time.time() + timeout_sec
        tmpl_buf = (ctypes.c_ubyte * MAX_TEMPLATE_SIZE)()
        img_size = self.width * self.height

        while time.time() < deadline:
            tmpl_len = ctypes.c_uint(MAX_TEMPLATE_SIZE)
            ret = self._lib.ZKFPM_AcquireFingerprint(
                self.dev_handle,
                self._img_buf,
                img_size,
                tmpl_buf,
                ctypes.byref(tmpl_len),
            )
            if ret == ZKFP_ERR_OK and tmpl_len.value > 0:
                template = bytes(tmpl_buf[: tmpl_len.value])
                image = bytes(self._img_buf)
                if require_lift_after:
                    # Live20R reuses the same press unless the finger is lifted.
                    self._wait_for_finger_lift(
                        timeout_sec=lift_timeout_sec,
                        poll_interval=poll_interval,
                    )
                return template, image
            if ret not in (ZKFP_ERR_OK, ZKFP_ERR_CAPTURE):
                raise RuntimeError(f"ZKFPM_AcquireFingerprint failed: {ret}")
            time.sleep(poll_interval)

        raise TimeoutError(
            f"No fingerprint captured within {timeout_sec:.0f}s — "
            "place finger firmly on the scanner"
        )

    def _wait_for_finger_lift(
        self,
        timeout_sec: float = 20.0,
        poll_interval: float = 0.1,
        clear_reads: int = 4,
    ) -> None:
        """Block until the sensor reports no finger for several polls in a row."""
        if not self.dev_handle or self._img_buf is None:
            return

        deadline = time.time() + timeout_sec
        empty = 0
        tmpl_buf = (ctypes.c_ubyte * MAX_TEMPLATE_SIZE)()
        img_size = self.width * self.height

        while time.time() < deadline:
            tmpl_len = ctypes.c_uint(MAX_TEMPLATE_SIZE)
            ret = self._lib.ZKFPM_AcquireFingerprint(
                self.dev_handle,
                self._img_buf,
                img_size,
                tmpl_buf,
                ctypes.byref(tmpl_len),
            )
            if ret == ZKFP_ERR_CAPTURE:
                empty += 1
                if empty >= clear_reads:
                    return
            elif ret == ZKFP_ERR_OK:
                empty = 0
            elif ret not in (ZKFP_ERR_OK, ZKFP_ERR_CAPTURE):
                # Device glitch — treat as lifted so caller can retry/reconnect
                logger.warning(f"Finger-lift poll returned {ret}; continuing")
                return
            time.sleep(poll_interval)

        logger.warning("Finger still on sensor after wait — continuing anyway")

    def merge_templates(self, t1: bytes, t2: bytes, t3: bytes) -> bytes:
        if not self.db_handle:
            raise RuntimeError("DB not initialized")

        def as_buf(data: bytes):
            return (ctypes.c_ubyte * len(data)).from_buffer_copy(data)

        out = (ctypes.c_ubyte * MAX_TEMPLATE_SIZE)()
        out_len = ctypes.c_uint(MAX_TEMPLATE_SIZE)
        ret = self._lib.ZKFPM_DBMerge(
            self.db_handle,
            as_buf(t1), as_buf(t2), as_buf(t3),
            out, ctypes.byref(out_len),
        )
        if ret != ZKFP_ERR_OK or out_len.value == 0:
            raise RuntimeError(f"ZKFPM_DBMerge failed: {ret}")
        return bytes(out[: out_len.value])

    def match(self, template1: bytes, template2: bytes) -> int:
        if not self.db_handle:
            raise RuntimeError("DB not initialized")

        b1 = (ctypes.c_ubyte * len(template1)).from_buffer_copy(template1)
        b2 = (ctypes.c_ubyte * len(template2)).from_buffer_copy(template2)
        score = self._lib.ZKFPM_DBMatch(
            self.db_handle, b1, len(template1), b2, len(template2)
        )
        return int(score)
