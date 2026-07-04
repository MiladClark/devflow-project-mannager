import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import type { CreateDbContainerOptions, DbContainer } from '../../src/shared/types'
import { getDockerStatus, listDbContainers, listDatabases, createDatabase, containerAction } from '../lib/docker'
import { store } from '../lib/store'

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args)
}

function log(text: string, stream: 'out' | 'err' | 'sys' = 'out') {
  broadcast('docker:log', { ts: Date.now(), stream, text })
}

function activity(level: 'ok' | 'info' | 'warn' | 'err', title: string, message: string) {
  const ev = store.addActivity({ level, title, message })
  broadcast('activity:event', ev)
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/

function createContainer(opts: CreateDbContainerOptions): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!NAME_RE.test(opts.name)) {
      return resolve({ ok: false, error: 'Invalid container name.' })
    }
    if (!opts.password) {
      return resolve({ ok: false, error: 'A root password is required.' })
    }
    const image = opts.kind === 'postgres' ? 'postgres:16' : 'mysql:8.4'
    const args =
      opts.kind === 'postgres'
        ? ['run', '-d', '--name', opts.name, '-e', `POSTGRES_PASSWORD=${opts.password}`, '-p', `${opts.hostPort}:5432`, image]
        : ['run', '-d', '--name', opts.name, '-e', `MYSQL_ROOT_PASSWORD=${opts.password}`, '-p', `${opts.hostPort}:3306`, image]

    log(`$ docker run -d --name ${opts.name} -p ${opts.hostPort}:${opts.kind === 'postgres' ? 5432 : 3306} ${image}`, 'sys')
    log('Pulling the image on first use can take a few minutes...', 'sys')

    const child = spawn('docker', args, { windowsHide: true })
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => log(c.toString().trim()))
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString()
      log(c.toString().trim(), 'err')
    })
    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('exit', (code) => {
      if (code === 0) {
        log('Container created.', 'sys')
        activity('ok', 'Database Container Created', `${opts.name} (${image}) on port ${opts.hostPort}`)
        resolve({ ok: true })
      } else {
        resolve({ ok: false, error: stderr.trim().split(/\r?\n/).pop() || `docker run exited with code ${code}` })
      }
    })
  })
}

export function registerDockerHandlers() {
  ipcMain.handle('docker:status', () => getDockerStatus())
  ipcMain.handle('docker:containers', () => listDbContainers())
  ipcMain.handle('docker:listDatabases', (_e, container: DbContainer) => listDatabases(container))

  ipcMain.handle('docker:createDatabase', async (_e, container: DbContainer, name: string) => {
    const res = await createDatabase(container, name)
    if (res.ok) activity('ok', 'Database Created', `${name} in ${container.name}`)
    return res
  })

  ipcMain.handle('docker:containerAction', async (_e, id: string, action: 'start' | 'stop' | 'restart') => {
    const res = await containerAction(id, action)
    const c = (await listDbContainers()).find((x) => x.id === id)
    if (res.ok) activity('info', `Container ${action === 'start' ? 'Started' : action === 'stop' ? 'Stopped' : 'Restarted'}`, c?.name ?? id.slice(0, 12))
    return res
  })

  ipcMain.handle('docker:createContainer', (_e, opts: CreateDbContainerOptions) => createContainer(opts))
}
