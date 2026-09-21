import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import express from 'express'
import { migrate } from './db.js'
import { router } from './routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

if (fs.existsSync(path.join(process.cwd(), '.env'))) {
  process.loadEnvFile('.env')
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Refusing to start.')
  process.exit(1)
}

const app = express()
app.use(express.json())

app.get('/healthz', (_req, res) => res.status(200).send('ok'))

app.use('/api', router)

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  // SPA fallback for client-side routes (e.g. /quiz/3, /parent/session/x).
  // Plain middleware (no path pattern) to sidestep Express 5's stricter
  // path-to-regexp wildcard syntax.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal server error' })
})

const port = process.env.PORT || 3000

migrate()
  .then(() => {
    app.listen(port, () => console.log(`JunsVoca server listening on :${port}`))
  })
  .catch((err) => {
    console.error('Migration failed', err)
    process.exit(1)
  })
