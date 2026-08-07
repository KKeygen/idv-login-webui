import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const moduleOrder = [
  'src/api.js',
  'src/gameRailStorage.js',
  'src/launcherCache.js',
  'src/dialogService.js',
  'src/modalStack.js',
  'src/installRequirements.js',
  'src/motion.js',
  'src/composables/useAppStore.js',
  'src/components/ModalShell.vue',
  'src/components/HelpTip.vue',
  'src/components/MotionProgressRing.vue',
  'src/components/AppDialogHost.vue',
  'src/components/InstallGameModal.vue',
  'src/components/GameSettingsModal.vue',
  'src/components/LauncherView.vue',
  'src/components/GameRail.vue',
  'src/components/AccountsView.vue',
  'src/components/CloudSyncView.vue',
  'src/components/SettingsView.vue',
  'src/App.vue',
]

function normalizePath(value) {
  return value.replaceAll('\\', '/')
}

function resolveLocal(fromModule, specifier) {
  const base = normalizePath(posix.normalize(posix.join(posix.dirname(fromModule), specifier)))
  if (extname(base)) return base
  for (const suffix of ['.js', '.vue', '/index.js']) {
    const candidate = `${base}${suffix}`
    if (existsSync(resolve(root, candidate))) return candidate
  }
  throw new Error(`Cannot resolve ${specifier} from ${fromModule}`)
}

function destructureClause(clause) {
  const inner = clause.trim().replace(/^\{/, '').replace(/\}$/, '').trim()
  if (!inner) return '{}'
  const fields = inner.split(',').map(part => {
    const value = part.trim()
    const match = value.match(/^([\w$]+)\s+as\s+([\w$]+)$/)
    return match ? `${match[1]}: ${match[2]}` : value
  })
  return `{ ${fields.join(', ')} }`
}

function importDeclaration(clause, specifier, fromModule) {
  const trimmed = clause.trim()
  let source
  if (specifier === 'vue') source = 'Vue'
  else if (specifier === '@lucide/vue') source = 'LucideVue'
  else if (specifier.startsWith('.')) {
    const target = resolveLocal(fromModule, specifier)
    source = `__modules[${JSON.stringify(target)}]`
  } else {
    throw new Error(`Unsupported external import ${specifier} in ${fromModule}`)
  }

  if (trimmed.startsWith('{')) return `const ${destructureClause(trimmed)} = ${source};`
  if (trimmed.startsWith('* as ')) return `const ${trimmed.slice(5).trim()} = ${source};`

  const mixed = trimmed.match(/^([\w$]+)\s*,\s*(\{[\s\S]+\})$/)
  if (mixed) {
    return `const ${mixed[1]} = ${source}.default;\nconst ${destructureClause(mixed[2])} = ${source};`
  }
  return `const ${trimmed} = ${source}.default;`
}

function stripImports(code, modulePath) {
  const imports = []
  code = code.replace(/^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm, (_, clause, specifier) => {
    imports.push(importDeclaration(clause, specifier, modulePath))
    return ''
  })
  code = code.replace(/^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm, (_, specifier) => {
    if (!specifier.endsWith('.css')) throw new Error(`Unsupported side-effect import ${specifier} in ${modulePath}`)
    return ''
  })
  return { code, imports }
}

function transformJs(modulePath) {
  let code = readFileSync(resolve(root, modulePath), 'utf8')
  const { code: withoutImports, imports } = stripImports(code, modulePath)
  code = withoutImports
  const exports = []

  code = code.replace(/^export\s+class\s+([\w$]+)/gm, (_, name) => {
    exports.push(name)
    return `class ${name}`
  })
  code = code.replace(/^export\s+(async\s+)?function\s+([\w$]+)/gm, (_, asyncPrefix = '', name) => {
    exports.push(name)
    return `${asyncPrefix || ''}function ${name}`
  })
  code = code.replace(/^export\s+(const|let|var)\s+([\w$]+)/gm, (_, kind, name) => {
    exports.push(name)
    return `${kind} ${name}`
  })
  if (/^\s*export\s+/m.test(code)) throw new Error(`Unprocessed export in ${modulePath}`)

  return `__modules[${JSON.stringify(modulePath)}] = (() => {\n'use strict';\n${imports.join('\n')}\n${code}\nreturn { ${[...new Set(exports)].join(', ')} };\n})();\n//# sourceURL=${modulePath}\n`
}

function transformVue(modulePath) {
  const filename = resolve(root, modulePath)
  const source = readFileSync(filename, 'utf8')
  const { descriptor, errors } = parse(source, { filename: modulePath })
  if (errors.length) throw new Error(`${modulePath}: ${errors.join('\n')}`)
  let code = compileScript(descriptor, {
    id: `idv-${modulePath.replace(/\W/g, '-')}`,
    inlineTemplate: true,
    genDefaultAs: '__default__',
  }).content
  const { code: withoutImports, imports } = stripImports(code, modulePath)
  code = withoutImports
  if (/^\s*export\s+/m.test(code)) throw new Error(`Unprocessed export in ${modulePath}`)
  return `__modules[${JSON.stringify(modulePath)}] = (() => {\n'use strict';\n${imports.join('\n')}\n${code}\nreturn { default: __default__ };\n})();\n//# sourceURL=${modulePath}\n`
}

const vueGlobal = readFileSync(resolve(root, 'node_modules/vue/dist/vue.global.prod.js'), 'utf8')
let lucide = readFileSync(resolve(root, 'node_modules/@lucide/vue/dist/cjs/lucide-vue.js'), 'utf8')
lucide = lucide.replace("var vue = require('vue');", 'var vue = Vue;')
if (lucide.includes("require('vue')")) throw new Error('Lucide Vue require transform failed')

const modules = moduleOrder.map(modulePath => (
  modulePath.endsWith('.vue') ? transformVue(modulePath) : transformJs(modulePath)
)).join('\n')
const css = readFileSync(resolve(root, 'src/style.css'), 'utf8').replaceAll('</style', '<\\/style')
const script = `${vueGlobal}\nconst LucideVue = (() => { const exports = {}; const module = { exports };\n${lucide}\nreturn module.exports; })();\nconst __modules = Object.create(null);\n${modules}\n__modules['src/api.js'].installIdvWindowOpenRewrite();\nVue.createApp(__modules['src/App.vue'].default).mount('#app');`
  .replaceAll('</script', '<\\/script')

const html = `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width,initial-scale=1.0" />\n<meta name="color-scheme" content="dark" />\n<title>网易渠道服工具</title>\n<style>${css}</style>\n</head>\n<body><div id="app"></div><script>${script}</script></body>\n</html>\n`
mkdirSync(resolve(root, 'dist'), { recursive: true })
writeFileSync(resolve(root, 'dist/index.html'), html)
console.log(`Built dist/index.html (${Buffer.byteLength(html).toLocaleString()} bytes)`)
