/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const espree = require('espree')
const evk = require('eslint-visitor-keys')

const DEFAULT_SCAN_DIR = 'lib'

// The project-wide require graph is expensive to build (parses every file
// under scanDir) but does not change within a single lint run, so it is
// built once per (pkgRoot, scanDir) pair and reused for every file ESLint
// visits. With `--concurrency` workers each have their own module cache and
// will rebuild it once independently, which is still cheap relative to a
// full lint run.
const graphCache = new Map()

function findPackageRoot(startDir) {
  let dir = startDir
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      return startDir
    }
    dir = parent
  }
}

function loadImportsMap(pkgRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'))
    return pkg.imports || {}
  } catch {
    return {}
  }
}

// Resolves the subset of Node's subpath-imports syntax this repo actually
// uses: a single `*` wildcard per pattern, e.g. `#agentlib/*.js` -> `./lib/*.js`.
// This does not implement the full subpath-imports spec (conditions, nested
// wildcards), only what package.json#imports here needs.
function resolveSubpathImport(importsMap, req) {
  for (const [pattern, target] of Object.entries(importsMap)) {
    if (!pattern.includes('*')) {
      if (pattern === req) {
        return target
      }
      continue
    }
    const [prefix, suffix] = pattern.split('*')
    if (req.startsWith(prefix) && req.endsWith(suffix) && req.length >= prefix.length + suffix.length) {
      const captured = req.slice(prefix.length, req.length - suffix.length)
      return target.replace('*', captured)
    }
  }
  return null
}

function resolveRequireTarget(fromFile, req, pkgRoot, importsMap) {
  let base
  if (req.startsWith('#')) {
    const mapped = resolveSubpathImport(importsMap, req)
    if (!mapped) {
      return null
    }
    base = path.join(pkgRoot, mapped)
  } else if (req.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), req)
  } else {
    return null // external package; not tracked
  }

  for (const candidate of [base, base + '.js', path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full)
    }
  }
}

function findRequireCalls(ast) {
  const calls = []
  ;(function visit(node) {
    if (!node || typeof node.type !== 'string') {
      return
    }
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'require' &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'Literal' &&
      typeof node.arguments[0].value === 'string'
    ) {
      calls.push(node.arguments[0].value)
    }
    for (const key of evk.KEYS[node.type] || evk.getKeys(node)) {
      const value = node[key]
      if (Array.isArray(value)) {
        value.forEach(visit)
      } else if (value && typeof value.type === 'string') {
        visit(value)
      }
    }
  })(ast)
  return calls
}

// Tarjan's strongly-connected-components algorithm. Returns a Map of
// file -> array of all files in its cycle, for files that are part of a
// multi-node cycle. Files not in a cycle are absent from the map.
function findCycles(graph) {
  let index = 0
  const stack = []
  const onStack = new Set()
  const indices = new Map()
  const lowlink = new Map()
  const components = []

  function strongconnect(v) {
    indices.set(v, index)
    lowlink.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)

    for (const w of graph.get(v) || []) {
      if (!indices.has(w)) {
        strongconnect(w)
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)))
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), indices.get(w)))
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const comp = []
      let w
      do {
        w = stack.pop()
        onStack.delete(w)
        comp.push(w)
      } while (w !== v)
      if (comp.length > 1) {
        components.push(comp)
      }
    }
  }

  for (const v of graph.keys()) {
    if (!indices.has(v)) {
      strongconnect(v)
    }
  }

  const cyclesByFile = new Map()
  for (const comp of components) {
    for (const file of comp) {
      cyclesByFile.set(file, comp)
    }
  }
  return cyclesByFile
}

function buildGraph(pkgRoot, scanDir) {
  const importsMap = loadImportsMap(pkgRoot)
  const files = []
  walk(scanDir, files)

  const graph = new Map()
  for (const file of files) {
    let ast
    try {
      ast = espree.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 2022, sourceType: 'module' })
    } catch {
      continue // unparsable file; let other rules/parsers surface that error
    }

    const deps = new Set()
    for (const req of findRequireCalls(ast)) {
      const target = resolveRequireTarget(file, req, pkgRoot, importsMap)
      if (target && target !== file) {
        deps.add(target)
      }
    }
    graph.set(file, deps)
  }

  return { importsMap, cyclesByFile: findCycles(graph) }
}

function getGraph(pkgRoot, scanDir) {
  if (!graphCache.has(scanDir)) {
    graphCache.set(scanDir, buildGraph(pkgRoot, scanDir))
  }
  return graphCache.get(scanDir)
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow require() cycles between internal modules.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          scanDir: { type: 'string' }
        },
        additionalProperties: false
      }
    ]
  },

  create (context) {
    const filename = context.filename ?? context.getFilename()
    if (!path.isAbsolute(filename)) {
      return {} // linting text piped on stdin, not a real file; nothing to resolve against
    }

    const pkgRoot = findPackageRoot(path.dirname(filename))
    const scanDirName = context.options[0]?.scanDir ?? DEFAULT_SCAN_DIR
    const scanDir = path.join(pkgRoot, scanDirName)

    if (!filename.startsWith(scanDir + path.sep)) {
      return {}
    }

    const { importsMap, cyclesByFile } = getGraph(pkgRoot, scanDir)
    const cycle = cyclesByFile.get(filename)
    if (!cycle) {
      return {}
    }

    const cycleDescription = [...cycle, cycle[0]].map((f) => path.relative(pkgRoot, f)).join(' -> ')

    return {
      CallExpression (node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'require' ||
          node.arguments.length !== 1 ||
          node.arguments[0].type !== 'Literal' ||
          typeof node.arguments[0].value !== 'string'
        ) {
          return
        }

        const req = node.arguments[0].value
        const target = resolveRequireTarget(filename, req, pkgRoot, importsMap)
        if (!target || !cycle.includes(target)) {
          return
        }

        context.report({
          node,
          message: `Circular require via '${req}' — part of a dependency cycle: ${cycleDescription}`
        })
      }
    }
  }
}
