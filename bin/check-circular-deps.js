#!/usr/bin/env node
/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const espree = require('espree')

const PKG_ROOT = path.resolve(__dirname, '..')

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
    for (const key in node) {
      if (key === 'loc' || key === 'range') {
        continue
      }
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

// Tarjan's strongly-connected-components algorithm. Returns an array of
// multi-file cycles, each an array of the absolute file paths in that cycle.
function findCycles(graph) {
  let index = 0
  const stack = []
  const onStack = new Set()
  const indices = new Map()
  const lowlink = new Map()
  const cycles = []

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
        cycles.push(comp)
      }
    }
  }

  for (const v of graph.keys()) {
    if (!indices.has(v)) {
      strongconnect(v)
    }
  }

  return cycles
}

function findCircularDeps(scanDir, pkgRoot) {
  const importsMap = loadImportsMap(pkgRoot)
  const files = []
  walk(scanDir, files)

  const graph = new Map()
  for (const file of files) {
    let ast
    try {
      ast = espree.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 2022, sourceType: 'module' })
    } catch (err) {
      console.warn(`Skipping unparsable file ${path.relative(pkgRoot, file)}: ${err.message}`)
      continue
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

  return findCycles(graph)
}

function main() {
  const scanDir = path.join(PKG_ROOT, 'lib')
  const cycles = findCircularDeps(scanDir, PKG_ROOT)

  if (cycles.length === 0) {
    console.log(`No circular requires found in ${path.relative(PKG_ROOT, scanDir)}/.`)
    return
  }

  console.error(`Found ${cycles.length} circular require cycle(s):\n`)
  for (const cycle of cycles) {
    const cycleDescription = [...cycle, cycle[0]].map((f) => path.relative(PKG_ROOT, f)).join(' -> ')
    console.error(`  ${cycleDescription}\n`)
  }
  process.exitCode = 1
}

if (require.main === module) {
  main()
} else {
  module.exports = { findCircularDeps, findCycles, resolveRequireTarget }
}
