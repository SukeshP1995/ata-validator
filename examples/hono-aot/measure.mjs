import { build as esbuild } from 'esbuild'
import { gzipSync } from 'node:zlib'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const targets = [
  { name: 'ata-AOT', entry: 'src/ata-app.js' },
  { name: 'AJV-runtime', entry: 'src/ajv-app.js' },
]

const results = []
for (const t of targets) {
  const result = await esbuild({
    entryPoints: [t.entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    write: false,
    external: ['cloudflare:*'],
    loader: { '.json': 'json' },
  })
  const bytes = result.outputFiles[0].contents
  const gz = gzipSync(bytes).length
  results.push({ name: t.name, bytes: bytes.length, gz })
}

const aot = results.find(r => r.name === 'ata-AOT')
const ajv = results.find(r => r.name === 'AJV-runtime')
const ratio = (ajv.gz / aot.gz).toFixed(1)

const honoVersion = require('./node_modules/hono/package.json').version
const ajvVersion = require('./node_modules/ajv/package.json').version
const esbuildVersion = require('./node_modules/esbuild/package.json').version

console.log()
console.log('## Hono + ata-AOT vs Hono + AJV-runtime — bundle size')
console.log()
console.log('| Bundle | Raw bytes | Gzipped | Ratio |')
console.log('|---|---|---|---|')
console.log(`| ata-AOT | ${aot.bytes.toLocaleString()} B | ${aot.gz.toLocaleString()} B | baseline |`)
console.log(`| AJV-runtime | ${ajv.bytes.toLocaleString()} B | ${ajv.gz.toLocaleString()} B | ${ratio}× larger |`)
console.log()
console.log(`ata-AOT bundle is ${ratio}× smaller gzipped.`)
console.log()
console.log(`Methodology: esbuild ${esbuildVersion}, format=esm, target=es2022, minify=true, platform=browser.`)
console.log(`Hono ${honoVersion}, AJV ${ajvVersion}.`)
