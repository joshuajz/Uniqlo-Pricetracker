import assert from 'node:assert/strict'
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

test('compiled server handler loads as ESM and serves direct country requests', async () => {
  // Vercel reads the root tsconfig, not the referenced Vite type-check configs.
  const root = new URL('../', import.meta.url)
  const config = ts.readConfigFile(new URL('tsconfig.json', root).pathname, ts.sys.readFile)
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root.pathname)
  const output = await mkdtemp(join(tmpdir(), 'uniqlo-server-'))
  try {
    await writeFile(join(output, 'package.json'), '{"type":"module"}')
    for (const file of ['api/page.ts', 'src/lib/metadata.ts', 'src/lib/markets.ts']) {
      const source = await readFile(new URL(file, root), 'utf8')
      const compiled = ts.transpileModule(source, { compilerOptions: options, fileName: file })
      const destination = join(output, file.replace(/\.ts$/, '.js'))
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, compiled.outputText)
    }
    const { default: handler } = await import(pathToFileURL(join(output, 'api/page.js')).href)
    // The production template is read relative to the function working directory.
    // Supply an isolated fixture so this check also runs before a Vite build.
    await mkdir(join(output, 'dist'))
    await writeFile(join(output, 'dist/index.html'), await readFile(new URL('index.html', root)))
    const previous = process.cwd()
    process.chdir(output)
    try {
      for (const market of ['ca', 'us', 'uk', 'jp']) {
        const headers = new Map()
        let html = ''
        const response = { statusCode: 0, setHeader: (key: string, value: string) => headers.set(key, value), end: (body: string) => { html = body } }
        await handler({ url: `/api/page?path=/${market}` }, response)
        assert.equal(response.statusCode, 200)
        assert.equal(headers.get('Content-Type'), 'text/html; charset=utf-8')
        assert.ok(html.includes(`href="https://www.uniqlotracker.com/${market}"`))
        assert.ok(html.includes('id="root"'))
      }
    } finally { process.chdir(previous) }
  } finally { await rm(output, { recursive: true, force: true }) }
})
