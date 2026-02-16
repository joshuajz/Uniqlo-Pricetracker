import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Start Vite dev server
const vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: join(__dirname, '..')
})

vite.on('close', (code) => {
  process.exit(code)
})
