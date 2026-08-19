import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const PG_PORT = 54329
const API_PORT = 5000
const FP_PORT = 5001
const SCHEMA_VERSION = '1'

export type ResourcePaths = {
  root: string
  backend: string
  postgresql: string
  node: string
  fingerprint: string
  sdkWindows: string
  sdkLinux: string
  databaseSql: string
}

export function isPackaged(): boolean {
  return app.isPackaged
}

/** Repo root in dev; Electron resources root when packaged. */
export function getResourceRoot(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  // frontend/dist → frontend → repo
  return path.resolve(__dirname, '..', '..')
}

export function resolveResources(): ResourcePaths {
  const root = getResourceRoot()
  const packaged = app.isPackaged

  if (packaged) {
    return {
      root,
      backend: path.join(root, 'backend'),
      postgresql: path.join(root, 'postgresql'),
      node: path.join(root, 'node'),
      fingerprint: path.join(root, 'fingerprint'),
      sdkWindows: path.join(root, 'sdk', 'windows'),
      sdkLinux: path.join(root, 'sdk', 'linux'),
      databaseSql: path.join(root, 'backend', 'database'),
    }
  }

  // Dev: services live in the monorepo; portable runtimes under vendor/
  return {
    root,
    backend: path.join(root, 'backend'),
    postgresql: path.join(root, 'vendor', 'postgresql-win'),
    node: path.join(root, 'vendor', 'node-win'),
    fingerprint: path.join(root, 'fingerprint-service'),
    sdkWindows: path.join(root, 'resources', 'sdk', 'windows'),
    sdkLinux: path.join(root, 'resources', 'sdk', 'SDK', 'lib-x64'),
    databaseSql: path.join(root, 'backend', 'database'),
  }
}

export function getUserDataPaths() {
  const base = app.getPath('userData')
  return {
    base,
    pgData: path.join(base, 'pgdata'),
    logs: path.join(base, 'logs'),
    credentials: path.join(base, 'credentials.json'),
    schemaStamp: path.join(base, '.schema_version'),
    backendEnv: path.join(base, 'backend.env'),
  }
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

export function binName(name: string): string {
  return process.platform === 'win32' ? `${name}.exe` : name
}

export { PG_PORT, API_PORT, FP_PORT, SCHEMA_VERSION }
