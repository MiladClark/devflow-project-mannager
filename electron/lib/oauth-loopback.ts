import http from 'node:http'
import { shell } from 'electron'
import { randomBytes } from 'node:crypto'

export type OAuthCallback = { code: string; state: string; expectedState: string }

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

/** Start loopback server, open browser to DevTune connect page, wait for redirect. */
export function runOAuthLoopback(serverUrl: string): Promise<OAuthCallback> {
  const expectedState = randomBytes(16).toString('base64url')

  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      server.close()
      reject(new Error('Authorization timed out. Close the browser tab and try again.'))
    }, CALLBACK_TIMEOUT_MS)

    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (url.pathname !== '/callback') {
          res.writeHead(404)
          res.end()
          return
        }
        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:48px">' +
            '<h2>DevFlow authorized</h2><p>You can close this tab and return to DevFlow Manager.</p>' +
            '</body></html>',
        )
        if (!settled && code && returnedState) {
          if (returnedState !== expectedState) {
            settled = true
            clearTimeout(timer)
            server.close()
            reject(new Error('Authorization state mismatch — try again.'))
            return
          }
          settled = true
          clearTimeout(timer)
          server.close()
          resolve({ code, state: returnedState, expectedState })
        }
      } catch (err) {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          server.close()
          reject(err)
        }
      }
    })

    server.on('error', (err) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(err)
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      if (!port) {
        settled = true
        clearTimeout(timer)
        server.close()
        reject(new Error('Could not start local authorization server.'))
        return
      }
      const connectUrl = new URL('/connect/devflow', serverUrl)
      connectUrl.searchParams.set('port', String(port))
      connectUrl.searchParams.set('state', expectedState)
      void shell.openExternal(connectUrl.toString())
    })
  })
}
