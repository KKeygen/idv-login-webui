import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'

const root = resolve(new URL('..', import.meta.url).pathname)
const src = join(root, 'src')

function walk(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const files = walk(src).filter(path => extname(path) === '.vue')
let checked = 0
for (const filename of files) {
  const display = relative(root, filename).replaceAll('\\', '/')
  const source = readFileSync(filename, 'utf8')
  const { descriptor, errors } = parse(source, { filename: display })
  if (errors.length) throw new Error(`${display}: ${errors.join('\n')}`)
  if (descriptor.script || descriptor.scriptSetup) {
    compileScript(descriptor, { id: `check-${display.replace(/\W/g, '-')}` })
  }
  if (descriptor.template) {
    const result = compileTemplate({
      id: `check-${display.replace(/\W/g, '-')}`,
      filename: display,
      source: descriptor.template.content,
      compilerOptions: { bindingMetadata: {} },
    })
    if (result.errors.length) throw new Error(`${display}: ${result.errors.join('\n')}`)
  }
  checked += 1
}
console.log(`Checked ${checked} Vue single-file components.`)
