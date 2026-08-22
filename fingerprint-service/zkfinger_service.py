#!/usr/bin/env python3
"""
ZKTeco Live20R Fingerprint Scanner Service

Primary path: native libzkfp.so (ctypes) — real USB hardware.
Detects USB port/device changes and auto-reconnects the SDK.
MOCK only when ALLOW_MOCK=1 (disabled by default).
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import base64
import logging
import threading
import time
from datetime import datetime
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('zkfinger_service')

app = Flask(__name__)
CORS(app)

ALLOW_MOCK = os.environ.get('ALLOW_MOCK', '0') == '1'
MATCH_THRESHOLD = int(os.environ.get('SCANNER_MATCH_THRESHOLD', '50'))
CAPTURE_TIMEOUT = float(os.environ.get('SCANNER_CAPTURE_TIMEOUT', '30'))

scanner_initialized = False
MODE = "UNINITIALIZED"
SDK_TYPE = "none"
native_scanner = None
zkfp = None
usb_schema = None          # current USB device identity/schema
_last_reconnect_at = 0.0
_scanner_lock = threading.RLock()

NATIVE_AVAILABLE = False
PYZKFP_AVAILABLE = False

try:
    from native_zkfp import NativeZKFP, ensure_library_path
    from usb_device import find_live20r, wait_for_live20r, lsusb_hint, UsbDeviceSchema
    ensure_library_path()
    NATIVE_AVAILABLE = True
    logger.info("Native ZKFinger SDK available")
except Exception as e:
    logger.warning(f"Native ZKFinger SDK unavailable: {e}")
    find_live20r = None  # type: ignore
    wait_for_live20r = None  # type: ignore
    lsusb_hint = lambda: ''  # type: ignore
    UsbDeviceSchema = None  # type: ignore

if not NATIVE_AVAILABLE:
    import shutil
    import subprocess

    def _configure_pythonnet_runtime():
        if os.environ.get('PYTHONNET_RUNTIME'):
            return
        dotnet = shutil.which('dotnet')
        if dotnet:
            os.environ['PYTHONNET_RUNTIME'] = 'coreclr'
            os.environ.setdefault('DOTNET_ROOT', os.path.dirname(os.path.realpath(dotnet)))
            return
        try:
            result = subprocess.run(
                ['ldconfig', '-p'], capture_output=True, text=True, timeout=5
            )
            if 'libmonosgen' in result.stdout:
                os.environ['PYTHONNET_RUNTIME'] = 'mono'
        except Exception:
            pass

    _configure_pythonnet_runtime()
    try:
        from pyzkfp import ZKFP2
        PYZKFP_AVAILABLE = True
        logger.info("pyzkfp available as fallback")
    except Exception as e:
        logger.warning(f"pyzkfp unavailable: {e}")

SDK_AVAILABLE = NATIVE_AVAILABLE or PYZKFP_AVAILABLE
MODE = "PRODUCTION" if SDK_AVAILABLE else ("MOCK" if ALLOW_MOCK else "DISABLED")

logger.info("=" * 60)
logger.info("ZKTeco Live20R Fingerprint Service")
logger.info("=" * 60)
logger.info(f"Native SDK    : {NATIVE_AVAILABLE}")
logger.info(f"pyzkfp fallback: {PYZKFP_AVAILABLE}")
logger.info(f"ALLOW_MOCK    : {ALLOW_MOCK}")
logger.info(f"Mode          : {MODE}")
logger.info("=" * 60)


def _update_usb_schema(device) -> bool:
    """
    Update tracked USB schema. Returns True if the device identity/port changed.
    """
    global usb_schema
    if device is None:
        changed = usb_schema is not None
        usb_schema = None
        return changed

    changed = usb_schema is None or not device.same_port(usb_schema)
    if changed:
        logger.info(
            "USB device schema updated: "
            f"bus={device.bus} addr={device.address} "
            f"path={device.sysfs_path} serial={device.serial or 'n/a'} "
            f"identity={device.identity}"
        )
    usb_schema = device
    return changed


def initialize_scanner() -> bool:
    """Initialize connection to ZKTeco fingerprint scanner."""
    global scanner_initialized, native_scanner, zkfp, MODE, SDK_TYPE

    with _scanner_lock:
        if not SDK_AVAILABLE and not NATIVE_AVAILABLE and not PYZKFP_AVAILABLE:
            if ALLOW_MOCK:
                logger.warning("No SDK — running in MOCK mode (ALLOW_MOCK=1)")
                MODE = "MOCK"
                SDK_TYPE = "mock"
                scanner_initialized = True
                return True
            MODE = "DISABLED"
            scanner_initialized = False
            return False

        # Prefer native path; never permanently disable it after one failure
        if NATIVE_AVAILABLE:
            try:
                return _open_native()
            except Exception as e:
                logger.error(f"Native SDK init failed: {e}")
                try:
                    if native_scanner:
                        native_scanner.terminate()
                except Exception:
                    pass
                native_scanner = None

        if PYZKFP_AVAILABLE:
            try:
                return _open_pyzkfp()
            except Exception as e:
                logger.error(f"pyzkfp init failed: {e}")
                zkfp = None

        if ALLOW_MOCK:
            MODE = "MOCK"
            SDK_TYPE = "mock"
            scanner_initialized = True
            return True

        MODE = "DISABLED"
        scanner_initialized = False
        return False


def _open_native() -> bool:
    global native_scanner, scanner_initialized, MODE, SDK_TYPE

    device = None
    if find_live20r:
        device = find_live20r()
        if device is None and wait_for_live20r:
            logger.info("Waiting for Live20R on USB …")
            device = wait_for_live20r(timeout_sec=6.0)
        if device is None:
            hint = lsusb_hint() if callable(lsusb_hint) else ''
            raise RuntimeError(
                "No ZKTeco Live20R detected on USB (1b55:0120). "
                f"{hint or 'Check cable and udev rules.'}"
            )
        _update_usb_schema(device)

    if native_scanner is None:
        native_scanner = NativeZKFP()

    # Always reconnect path when opening fresh / after failure
    native_scanner.terminate()
    time.sleep(0.25)
    native_scanner.init()
    count = native_scanner.get_device_count()
    if count < 1:
        raise RuntimeError("SDK initialized but GetDeviceCount() == 0")

    native_scanner.open_device(0)
    MODE = "PRODUCTION"
    SDK_TYPE = "native"
    scanner_initialized = True
    logger.info(
        f"ZKTeco Live20R opened (native), devices={count}, "
        f"usb={usb_schema.identity if usb_schema else 'unknown'}"
    )
    return True


def _open_pyzkfp() -> bool:
    global zkfp, scanner_initialized, MODE, SDK_TYPE
    from pyzkfp import ZKFP2

    zkfp = ZKFP2()
    zkfp.Init()
    count = zkfp.GetDeviceCount()
    if count < 1:
        raise RuntimeError("No ZKTeco scanner detected via USB")
    zkfp.OpenDevice(0)
    MODE = "PRODUCTION"
    SDK_TYPE = "pyzkfp"
    scanner_initialized = True
    logger.info(f"ZKTeco Live20R opened (pyzkfp), devices={count}")
    return True


def reconnect_scanner(reason: str = "manual") -> bool:
    """Force tear-down and reopen. Updates USB schema if the port changed."""
    global _last_reconnect_at, native_scanner, scanner_initialized, MODE

    with _scanner_lock:
        now = time.time()
        if now - _last_reconnect_at < 1.0:
            logger.info("Reconnect skipped (throttled)")
            return MODE == "PRODUCTION" and scanner_initialized

        _last_reconnect_at = now
        logger.info(f"Scanner reconnect requested ({reason})")

        try:
            if native_scanner:
                native_scanner.terminate()
        except Exception as e:
            logger.warning(f"Terminate during reconnect: {e}")

        scanner_initialized = False
        MODE = "DISABLED"

        # Wait briefly for USB re-enumeration after unplug/replug
        device = None
        if wait_for_live20r:
            device = wait_for_live20r(timeout_sec=8.0)
        elif find_live20r:
            device = find_live20r()

        if device:
            _update_usb_schema(device)
        else:
            _update_usb_schema(None)
            logger.error("Reconnect failed — Live20R not present on USB")
            return False

        try:
            if NATIVE_AVAILABLE:
                if native_scanner is None:
                    native_scanner = NativeZKFP()
                native_scanner.reconnect(0)
                MODE = "PRODUCTION"
                SDK_TYPE = "native"
                scanner_initialized = True
                logger.info(
                    f"Reconnect OK — schema={usb_schema.identity if usb_schema else '?'}"
                )
                return True
        except Exception as e:
            logger.error(f"Native reconnect failed: {e}")

        return initialize_scanner()


def ensure_scanner_ready() -> Optional[str]:
    """
    Ensure scanner is usable. Detects USB port/device changes and reconnects.
    Returns an error string if not ready, else None.
    """
    global MODE, scanner_initialized

    if ALLOW_MOCK and MODE == "MOCK":
        return None

    needs_reconnect = False
    reason = "auto-heal"

    with _scanner_lock:
        device = find_live20r() if find_live20r else None

        if device is None:
            if MODE == "PRODUCTION":
                logger.warning("USB device missing — closing SDK handles")
                try:
                    if native_scanner:
                        native_scanner.terminate()
                except Exception:
                    pass
                MODE = "DISABLED"
                scanner_initialized = False
                _update_usb_schema(None)
            return (
                "Fingerprint scanner not detected on USB. "
                "Plug in the Live20R and try again (or POST /scanner/reconnect)."
            )

        port_changed = _update_usb_schema(device)
        healthy = (
            MODE == "PRODUCTION"
            and scanner_initialized
            and native_scanner is not None
            and native_scanner.health_check()
        )

        if port_changed:
            needs_reconnect = True
            reason = "usb-port-changed"
        elif not healthy:
            needs_reconnect = True
            reason = "unhealthy-or-disconnected"

    if needs_reconnect:
        ok = reconnect_scanner(reason=reason)
        if not ok:
            return (
                "Scanner reconnect failed. Unplug/replug the Live20R, "
                "then retry or call /scanner/reconnect."
            )
    return None


def cleanup_scanner():
    global scanner_initialized, native_scanner, zkfp
    try:
        if native_scanner:
            native_scanner.terminate()
            native_scanner = None
        elif zkfp:
            try:
                zkfp.CloseDevice()
            except Exception:
                pass
            try:
                zkfp.Terminate()
            except Exception:
                pass
            zkfp = None
        scanner_initialized = False
        logger.info("Scanner cleanup completed")
    except Exception as e:
        logger.error(f"Scanner cleanup failed: {e}")


_init_done = False

@app.before_request
def lazy_init():
    global _init_done
    if not _init_done:
        _init_done = True
        if not scanner_initialized:
            initialize_scanner()


import atexit
atexit.register(cleanup_scanner)


def _require_ready():
    err = ensure_scanner_ready()
    if err:
        return jsonify({
            'success': False,
            'error': err,
            'mode': MODE,
            'usb': usb_schema.to_dict() if usb_schema else None,
        }), 503
    if MODE == "DISABLED" or not scanner_initialized:
        return jsonify({
            'success': False,
            'error': (
                'Fingerprint scanner is not available. '
                'Check USB connection or POST /scanner/reconnect.'
            ),
            'mode': MODE,
            'usb': usb_schema.to_dict() if usb_schema else None,
        }), 503
    return None


def _acquire_with_pyzkfp(timeout_sec: float):
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        capture = zkfp.AcquireFingerprint()
        if capture:
            tmp, img = capture
            if not isinstance(tmp, (bytes, bytearray)):
                tmp = bytes(tmp)
            return tmp, img
        time.sleep(0.1)
    raise TimeoutError(
        f"No fingerprint captured within {timeout_sec:.0f}s — "
        "place finger firmly on the scanner"
    )


def _usb_payload():
    return usb_schema.to_dict() if usb_schema else None


@app.route('/health', methods=['GET'])
def health_check():
    # Lightweight USB presence check (no forced reconnect)
    present = find_live20r() is not None if find_live20r else None
    return jsonify({
        'status': 'ok' if MODE == 'PRODUCTION' else ('degraded' if MODE != 'DISABLED' else 'down'),
        'service': 'zkfinger_service',
        'sdk_available': NATIVE_AVAILABLE or PYZKFP_AVAILABLE or MODE == 'MOCK',
        'sdk_type': SDK_TYPE,
        'mode': MODE,
        'scanner_initialized': scanner_initialized,
        'usb_present': present,
        'usb': _usb_payload(),
        'allow_mock': ALLOW_MOCK,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/scanner/status', methods=['GET'])
def get_scanner_status():
    # Auto-heal if USB port changed or connection dropped
    ensure_err = ensure_scanner_ready()
    connected = MODE == "PRODUCTION" and scanner_initialized and ensure_err is None

    payload = {
        'success': connected or MODE == 'MOCK',
        'connected': connected,
        'model': 'ZKTeco Live20R',
        'sdk_available': NATIVE_AVAILABLE or PYZKFP_AVAILABLE,
        'sdk_type': SDK_TYPE,
        'mode': MODE,
        'usb': _usb_payload(),
    }
    if ensure_err:
        payload['error'] = ensure_err
        return jsonify(payload), 503 if not connected else 200
    return jsonify(payload)


@app.route('/scanner/reconnect', methods=['POST'])
def scanner_reconnect():
    """Force reconnect — use after unplug/replug or USB port change."""
    ok = reconnect_scanner(reason="api")
    return jsonify({
        'success': ok,
        'connected': ok and MODE == 'PRODUCTION',
        'mode': MODE,
        'sdk_type': SDK_TYPE,
        'usb': _usb_payload(),
        'message': (
            'Scanner reconnected successfully' if ok
            else 'Reconnect failed — is the Live20R plugged in?'
        ),
    }), (200 if ok else 503)


@app.route('/scanner/test', methods=['GET'])
def test_scanner():
    err = _require_ready()
    if err:
        return err

    try:
        if MODE == "PRODUCTION" and native_scanner:
            return jsonify({
                'success': True,
                'connected': True,
                'device_count': native_scanner.get_device_count(),
                'message': 'Scanner test successful — real hardware (native)',
                'mode': 'PRODUCTION',
                'usb': _usb_payload(),
            })
        if MODE == "PRODUCTION" and zkfp:
            return jsonify({
                'success': True,
                'connected': True,
                'device_count': zkfp.GetDeviceCount(),
                'message': 'Scanner test successful — real hardware (pyzkfp)',
                'mode': 'PRODUCTION',
            })
        return jsonify({
            'success': True,
            'connected': False,
            'device_count': 0,
            'message': 'MOCK mode — no real hardware',
            'mode': 'MOCK',
        })
    except Exception as e:
        logger.error(f"Scanner test failed: {e}")
        # One reconnect attempt then fail
        reconnect_scanner(reason="test-failure")
        return jsonify({'success': False, 'error': str(e), 'usb': _usb_payload()}), 500


@app.route('/scanner/capture/enroll', methods=['POST'])
def capture_for_enrollment():
    err = _require_ready()
    if err:
        return err

    try:
        if MODE == "PRODUCTION" and native_scanner:
            logger.info("PRODUCTION: Enrollment capture (3 scans) via native SDK")
            templates = []
            for i in range(3):
                logger.info(f"  Waiting for scan {i+1}/3 — place finger on scanner …")
                try:
                    tmp, _img = native_scanner.acquire_fingerprint(timeout_sec=CAPTURE_TIMEOUT)
                except RuntimeError as capture_err:
                    logger.warning(f"Capture error, reconnecting once: {capture_err}")
                    if not reconnect_scanner(reason="capture-error"):
                        raise
                    tmp, _img = native_scanner.acquire_fingerprint(timeout_sec=CAPTURE_TIMEOUT)
                templates.append(tmp)
                logger.info(f"  Scan {i+1} captured ({len(tmp)} bytes)")
            enrollment = native_scanner.merge_templates(*templates)
            template_b64 = base64.b64encode(enrollment).decode('utf-8')
            return jsonify({
                'success': True,
                'template_id': f"FP{int(datetime.now().timestamp())}",
                'template': template_b64,
                'quality': 90,
                'mode': 'PRODUCTION',
                'usb': _usb_payload(),
            })

        if MODE == "PRODUCTION" and zkfp:
            logger.info("PRODUCTION: Enrollment capture (3 scans) via pyzkfp")
            templates = []
            for i in range(3):
                logger.info(f"  Waiting for scan {i+1}/3 — place finger on scanner …")
                tmp, _img = _acquire_with_pyzkfp(CAPTURE_TIMEOUT)
                templates.append(tmp)
                logger.info(f"  Scan {i+1} captured")
            enrollment_template, _ = zkfp.DBMerge(*templates)
            if enrollment_template is None:
                return jsonify({'success': False, 'error': 'Template merge failed'}), 400
            if not isinstance(enrollment_template, (bytes, bytearray)):
                enrollment_template = bytes(enrollment_template)
            template_b64 = base64.b64encode(enrollment_template).decode('utf-8')
            return jsonify({
                'success': True,
                'template_id': f"FP{int(datetime.now().timestamp())}",
                'template': template_b64,
                'quality': 90,
                'mode': 'PRODUCTION'
            })

        logger.warning("MOCK: Returning simulated enrollment template")
        template_id = f"FP{int(datetime.now().timestamp())}"
        template_b64 = base64.b64encode(f"mock_template_{template_id}".encode()).decode()
        return jsonify({
            'success': True,
            'template_id': template_id,
            'template': template_b64,
            'quality': 85,
            'mode': 'MOCK'
        })

    except TimeoutError as e:
        return jsonify({'success': False, 'error': str(e)}), 408
    except Exception as e:
        logger.error(f"Enrollment capture failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e), 'usb': _usb_payload()}), 500


@app.route('/scanner/capture/verify', methods=['POST'])
def capture_for_verification():
    err = _require_ready()
    if err:
        return err

    with _scanner_lock:
        try:
            if MODE == "PRODUCTION" and native_scanner:
                logger.info("PRODUCTION: Verification capture via native SDK …")
                try:
                    tmp, _img = native_scanner.acquire_fingerprint(timeout_sec=CAPTURE_TIMEOUT)
                except RuntimeError as capture_err:
                    logger.warning(f"Capture error, reconnecting once: {capture_err}")
                    if not reconnect_scanner(reason="capture-error"):
                        raise
                    tmp, _img = native_scanner.acquire_fingerprint(timeout_sec=CAPTURE_TIMEOUT)
                template_b64 = base64.b64encode(tmp).decode('utf-8')
                return jsonify({
                    'success': True,
                    'template': template_b64,
                    'quality': 85,
                    'mode': 'PRODUCTION',
                    'usb': _usb_payload(),
                })

            if MODE == "PRODUCTION" and zkfp:
                logger.info("PRODUCTION: Verification capture via pyzkfp …")
                tmp, _img = _acquire_with_pyzkfp(CAPTURE_TIMEOUT)
                template_b64 = base64.b64encode(tmp).decode('utf-8')
                return jsonify({
                    'success': True,
                    'template': template_b64,
                    'quality': 85,
                    'mode': 'PRODUCTION'
                })

            logger.warning("MOCK: Returning simulated verification scan")
            scan_id = f"SCAN{int(datetime.now().timestamp())}"
            template_b64 = base64.b64encode(f"mock_scan_{scan_id}".encode()).decode()
            return jsonify({
                'success': True,
                'template': template_b64,
                'quality': 80,
                'mode': 'MOCK'
            })

        except TimeoutError as e:
            return jsonify({'success': False, 'error': str(e)}), 408
        except Exception as e:
            logger.error(f"Verification capture failed: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e), 'usb': _usb_payload()}), 500


@app.route('/scanner/capture/sample', methods=['POST'])
def capture_sample():
    """Single finger placement — used for step-by-step enrollment."""
    return capture_for_verification()


@app.route('/scanner/enroll/merge', methods=['POST'])
def merge_enrollment_templates():
    """Merge three sample templates into one enrollment template."""
    err = _require_ready()
    if err:
        return err

    body = request.get_json(silent=True) or {}
    templates_b64 = body.get('templates') or []
    if not isinstance(templates_b64, list) or len(templates_b64) != 3:
        return jsonify({
            'success': False,
            'error': 'Exactly three fingerprint samples are required',
        }), 400

    with _scanner_lock:
        try:
            templates = [base64.b64decode(item) for item in templates_b64]
            if any(not item for item in templates):
                return jsonify({'success': False, 'error': 'One or more samples are empty'}), 400

            # Only reject exact duplicates (finger never lifted — same buffer reused).
            # High match scores between different presses of the same finger are normal.
            if templates[0] == templates[1] or templates[1] == templates[2] or templates[0] == templates[2]:
                return jsonify({
                    'success': False,
                    'error': (
                        'Duplicate scan detected — lift your finger fully '
                        'between each of the 3 scans, then try again'
                    ),
                }), 400

            if MODE == "PRODUCTION" and native_scanner:
                enrollment = native_scanner.merge_templates(*templates)
            elif MODE == "PRODUCTION" and zkfp:
                enrollment_template, _ = zkfp.DBMerge(*templates)
                if enrollment_template is None:
                    return jsonify({'success': False, 'error': 'Template merge failed'}), 400
                enrollment = (
                    bytes(enrollment_template)
                    if not isinstance(enrollment_template, (bytes, bytearray))
                    else enrollment_template
                )
            else:
                enrollment = templates[0]

            template_b64 = base64.b64encode(enrollment).decode('utf-8')
            return jsonify({
                'success': True,
                'template_id': f"FP{int(datetime.now().timestamp())}",
                'template': template_b64,
                'quality': 90,
                'mode': MODE,
                'usb': _usb_payload(),
            })
        except Exception as e:
            logger.error(f"Enrollment merge failed: {e}")
            import traceback
            traceback.print_exc()
            msg = str(e)
            if 'DBMerge' in msg or '-22' in msg:
                msg = (
                    'Could not merge the 3 scans — lift your finger fully between '
                    'each placement and use the same finger each time'
                )
            return jsonify({'success': False, 'error': msg, 'usb': _usb_payload()}), 500


@app.route('/scanner/match', methods=['POST'])
def match_fingerprints():
    err = _require_ready()
    if err:
        return err

    try:
        data = request.get_json() or {}
        captured_b64 = data.get('captured_template')
        stored_b64 = data.get('stored_template')

        if not captured_b64 or not stored_b64:
            return jsonify({'success': False, 'error': 'Missing template data'}), 400

        if MODE == "PRODUCTION" and native_scanner:
            captured = base64.b64decode(captured_b64)
            stored = base64.b64decode(stored_b64)
            score = native_scanner.match(captured, stored)
            matched = score >= MATCH_THRESHOLD
            confidence = min(max(score, 0) / 100.0, 1.0)
            logger.info(f"Match: {'YES' if matched else 'NO'} (score={score})")
            return jsonify({
                'success': True,
                'matched': matched,
                'confidence': confidence,
                'score': score,
                'mode': 'PRODUCTION'
            })

        if MODE == "PRODUCTION" and zkfp:
            captured = base64.b64decode(captured_b64)
            stored = base64.b64decode(stored_b64)
            score = zkfp.DBMatch(captured, stored)
            matched = score >= MATCH_THRESHOLD
            confidence = min(max(score, 0) / 100.0, 1.0)
            return jsonify({
                'success': True,
                'matched': matched,
                'confidence': confidence,
                'score': score,
                'mode': 'PRODUCTION'
            })

        logger.warning("MOCK: match always returns true (testing only)")
        return jsonify({
            'success': True,
            'matched': True,
            'confidence': 0.92,
            'score': 92,
            'mode': 'MOCK'
        })

    except Exception as e:
        logger.error(f"Fingerprint matching failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    if not initialize_scanner():
        logger.error("Scanner initialization failed at startup — service stays up for reconnect")
        logger.error("Checklist:")
        logger.error("  1. Live20R plugged in")
        logger.error("  2. Native libs: resources/sdk/SDK/lib-x64/libzkfp.so (Linux)")
        logger.error("     or resources/sdk/windows/libzkfp.dll (Windows) / ZKFP_LIB_DIR")
        logger.error("  3. Linux udev rule or Windows Live20R driver installed")
        logger.error("  4. After plugging in: POST http://127.0.0.1:5001/scanner/reconnect")
        # Do NOT exit — allow /scanner/reconnect when device appears
    app.run(host='127.0.0.1', port=5001, debug=False)
