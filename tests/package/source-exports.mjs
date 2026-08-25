import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))

for (const [specifier, target] of Object.entries(manifest.exports ?? {})) {
  if (!target || typeof target !== 'object' || typeof target.source !== 'string') {
    throw new Error(`Export ${specifier} is missing a source condition`)
  }

  if (!target.source.startsWith('./src/')) {
    throw new Error(`Export ${specifier} source must point into ./src`)
  }

  await access(resolve(root, target.source))
}

if (!Array.isArray(manifest.files) || !manifest.files.includes('src')) {
  throw new Error('package files must include src when source exports are declared')
}

console.log(`Validated ${Object.keys(manifest.exports ?? {}).length} source exports`)
