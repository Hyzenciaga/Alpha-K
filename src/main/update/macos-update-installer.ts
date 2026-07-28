import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import type { PreparedUpdate, StagedUpdateInstallation, UpdateInstaller } from './app-update-service.js'

const execFileAsync = promisify(execFile)

type MacUpdateInstallerDependencies = {
  appBundlePath: string
  appName: string
  currentVersion: string
  processId: number
  spawnDetached?: (command: string, args: string[]) => void
}

type MacStagedUpdateInstallation = StagedUpdateInstallation & {
  appPath: string
  stagedAppPath: string
  backupPath: string
  failedPath: string
  healthPath: string
  helperPath: string
  workspace: string
}

export class MacUpdateInstaller implements UpdateInstaller {
  constructor(private readonly dependencies: MacUpdateInstallerDependencies) {}

  async stageInstallation(update: PreparedUpdate): Promise<MacStagedUpdateInstallation> {
    const appPath = this.dependencies.appBundlePath
    const appParent = dirname(appPath)
    const appBaseName = basename(appPath)
    assertSafeAppName(this.dependencies.appName)
    if (appBaseName !== `${this.dependencies.appName}.app`) {
      throw new Error('当前应用路径与更新目标不匹配。')
    }
    await access(appPath, constants.R_OK)
    await access(appParent, constants.W_OK | constants.X_OK)
    const workspace = await mkdtemp(join(appParent, '.alpha-k-update-'))
    const stagedAppPath = join(workspace, appBaseName)
    const healthPath = join(workspace, 'healthy')
    const helperPath = join(workspace, 'install.sh')
    const backupPath = join(appParent, `.${appBaseName}.previous-${this.dependencies.currentVersion}-${randomUUID()}`)
    const failedPath = join(appParent, `.${appBaseName}.failed-${update.release.version}-${randomUUID()}`)
    await extractArchive(update.archivePath, workspace)
    await access(stagedAppPath, constants.R_OK | constants.X_OK)
    await access(join(stagedAppPath, 'Contents', 'MacOS', this.dependencies.appName), constants.X_OK)
    await writeFile(helperPath, INSTALL_HELPER_SCRIPT, { mode: 0o700 })
    await chmod(helperPath, 0o700)
    return { update, appPath, stagedAppPath, backupPath, failedPath, healthPath, helperPath, workspace }
  }

  async launchInstallation(installation: StagedUpdateInstallation): Promise<void> {
    const staged = installation as MacStagedUpdateInstallation
    const args = [
      staged.helperPath,
      staged.appPath,
      staged.stagedAppPath,
      staged.backupPath,
      staged.failedPath,
      String(this.dependencies.processId),
      staged.healthPath,
      staged.workspace,
    ]
    const spawnDetached = this.dependencies.spawnDetached ?? defaultSpawnDetached
    spawnDetached('/bin/sh', args)
  }
}

export function updateHealthPathFromArgs(argumentsList: string[], appBundlePath: string): string | null {
  const argument = argumentsList.find((value) => value.startsWith('--alpha-k-update-health='))
  if (!argument) return null
  const healthPath = resolve(argument.slice('--alpha-k-update-health='.length))
  const appParent = dirname(resolve(appBundlePath))
  const workspace = dirname(healthPath)
  if (dirname(workspace) !== appParent) return null
  if (!basename(workspace).startsWith('.alpha-k-update-') || basename(healthPath) !== 'healthy') return null
  return healthPath
}

async function extractArchive(archivePath: string, destination: string): Promise<void> {
  await execFileAsync('/usr/bin/ditto', ['-x', '-k', archivePath, destination], { maxBuffer: 1_024 * 1_024 })
}

function defaultSpawnDetached(command: string, args: string[]): void {
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.unref()
}

function assertSafeAppName(appName: string): void {
  if (!/^[A-Za-z0-9 _-]+$/.test(appName)) throw new Error('应用名称不安全。')
}

const INSTALL_HELPER_SCRIPT = `#!/bin/sh
set -eu

target="$1"
staged="$2"
backup="$3"
failed="$4"
parent_pid="$5"
health="$6"
workspace="$7"

case "$(basename "$workspace")" in
  .alpha-k-update-*) ;;
  *) exit 64 ;;
esac

while kill -0 "$parent_pid" 2>/dev/null; do
  sleep 0.2
done

mv "$target" "$backup"
if ! mv "$staged" "$target"; then
  mv "$backup" "$target"
  exit 1
fi

/usr/bin/xattr -dr com.apple.quarantine "$target" 2>/dev/null || true
if ! /usr/bin/open "$target" --args "--alpha-k-update-health=$health"; then
  mv "$target" "$failed"
  mv "$backup" "$target"
  /usr/bin/open "$target" || true
  exit 1
fi

attempt=0
while [ "$attempt" -lt 150 ]; do
  if [ -f "$health" ]; then
    /bin/rm -rf "$workspace"
    exit 0
  fi
  sleep 0.2
  attempt=$((attempt + 1))
done

mv "$target" "$failed"
mv "$backup" "$target"
/usr/bin/open "$target"
exit 1
`
