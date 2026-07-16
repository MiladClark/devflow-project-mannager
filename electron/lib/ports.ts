import net from 'node:net'
import type { PortCheck, PortStatusOverview } from '../../src/shared/types'
import { store } from './store'
import { listOccupiedPorts } from './portOwner'

function probe(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => {
      srv.close(() => resolve(true))
    })
    srv.listen(port, host)
  })
}

export async function isPortFree(port: number): Promise<boolean> {
  // dev servers may bind either stack; the port is only free if both are
  const [v4, v6] = await Promise.all([probe(port, '127.0.0.1'), probe(port, '::1')])
  return v4 && v6
}

export async function checkPort(port: number, excludeProjectId?: string): Promise<PortCheck> {
  const settings = store.getSettings()
  const reserved = settings.reservedPorts.includes(port)
  const owner = store
    .getProjects()
    .find((p) => p.id !== excludeProjectId && (p.preferredPort ?? p.defaultPort) === port)
  const free = await isPortFree(port)
  return { port, free, reserved, usedByProject: owner?.name }
}

export async function getPortStatusOverview(): Promise<PortStatusOverview> {
  const settings = store.getSettings()
  const occupied = await listOccupiedPorts()
  return {
    reserved: [...settings.reservedPorts].sort((a, b) => a - b),
    occupied,
  }
}
