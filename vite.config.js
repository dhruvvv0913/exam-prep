import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Self-hosted ML assets live under these public/ folders.
const ASSET_DIRS = /^\/(models|ort|tesseract)\//

// By default Vite's dev server answers ANY unknown path with index.html (the
// SPA fallback). transformers.js / onnxruntime probe optional files that may
// not exist; getting index.html back makes them throw
// "Unexpected token '<', "<!doctype"... is not valid JSON". This plugin returns
// a real 404 for missing files in the asset folders so those probes are handled
// gracefully (as they are in Node).
function assetNotFound() {
  return {
    name: 'asset-404',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (ASSET_DIRS.test(url)) {
          const file = path.join(process.cwd(), 'public', decodeURIComponent(url))
          if (!fs.existsSync(file)) {
            res.statusCode = 404
            res.end('Not found')
            return
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), assetNotFound()],
})
