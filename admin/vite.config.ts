import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vite's dependency optimiser writes `<cacheDir>/deps_temp_<hash>` and then
// renames it onto `<cacheDir>/deps`. When the cache sits inside the project
// (its default, `node_modules/.vite`) and the project lives in a synced
// folder - Dropbox, OneDrive, Google Drive - the sync client keeps handles
// open on those files and Windows fails the rename with
// `EBUSY: resource busy or locked`. The optimised bundles never land, every
// request for them 404s, and the dashboard loads as a blank page.
//
// Keeping the cache in the OS temp directory takes it out of the synced tree
// altogether, so nothing else is holding the files when Vite swaps them. It
// also stops the sync client from uploading a cache that churns on every
// dependency change. The path is derived from the project directory so two
// checkouts don't share one cache; losing it to a temp-folder cleanup only
// costs one re-optimisation.
const projectKey = crypto.createHash('sha1').update(import.meta.dirname).digest('hex').slice(0, 8)
const cacheDir = path.join(os.tmpdir(), 'infunion-admin-vite', projectKey)

// https://vite.dev/config/
export default defineConfig({
  cacheDir,
  plugins: [react()],
})
