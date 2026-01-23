import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..', '..')
const dbSource = join(projectRoot, 'api', 'database', 'products.db')
const backupDir = join(projectRoot, 'api', 'database', 'backups')

function backupDatabase() {
  if (!existsSync(dbSource)) {
    console.log('No database found to backup, skipping...')
    return
  }

  // Create backups directory if it doesn't exist
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true })
  }

  // Generate timestamp for backup filename
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)

  const backupPath = join(backupDir, `products_${timestamp}.db`)

  try {
    copyFileSync(dbSource, backupPath)
    console.log(`Database backed up to: ${backupPath}`)
  } catch (err) {
    console.error('Failed to backup database:', err.message)
  }
}

// Backup the database
backupDatabase()

// Start Vite dev server
const vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: join(__dirname, '..')
})

vite.on('close', (code) => {
  process.exit(code)
})
