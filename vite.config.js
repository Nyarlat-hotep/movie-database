import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Vite doesn't know about the Vercel functions in api/, so /api/* would 404
// under `npm run dev` and every metadata search would fail locally. Mount the
// handlers on the dev server so `npm run dev` behaves like production.
function localApi(env) {
  return {
    name: 'local-api',
    configureServer(server) {
      // Handlers read secrets from process.env; Vite only exposes VITE_* to the
      // client, so copy the rest across for the server side.
      Object.assign(process.env, env)

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const route = req.url.split('?')[0].slice('/api/'.length)
        const file = path.resolve(import.meta.dirname, 'api', `${route}.js`)
        if (!route || !fs.existsSync(file)) return next()

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const raw = Buffer.concat(chunks).toString()
          req.body = raw ? JSON.parse(raw) : {}

          // Vercel's handler contract: res.status(n).json(obj)
          const vercelRes = {
            status(code) { res.statusCode = code; return this },
            json(data) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
              return this
            },
          }

          // ssrLoadModule picks up edits without restarting the dev server
          const mod = await server.ssrLoadModule(file)
          await mod.default(req, vercelRes)
        } catch (err) {
          server.config.logger.error(`[local-api] ${route}: ${err.stack || err}`)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: String(err.message || err) }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' prefix loads every var, not just VITE_*
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), localApi(env)] }
})
