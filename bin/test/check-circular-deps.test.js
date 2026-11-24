/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { findCircularDeps, findCycles, resolveRequireTarget } = require('../check-circular-deps.js')

function writeFixture(dir, files) {
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content)
  }
}

test('check-circular-deps script', async (t) => {
  await t.test('findCycles', async (t) => {
    await t.test('returns no cycles for an acyclic graph', () => {
      const graph = new Map([
        ['a', new Set(['b'])],
        ['b', new Set(['c'])],
        ['c', new Set()]
      ])
      assert.deepEqual(findCycles(graph), [])
    })

    await t.test('detects a direct two-node cycle', () => {
      const graph = new Map([
        ['a', new Set(['b'])],
        ['b', new Set(['a'])]
      ])
      const cycles = findCycles(graph)
      assert.equal(cycles.length, 1)
      assert.deepEqual(new Set(cycles[0]), new Set(['a', 'b']))
    })

    await t.test('detects a longer cycle', () => {
      const graph = new Map([
        ['a', new Set(['b'])],
        ['b', new Set(['c'])],
        ['c', new Set(['a'])]
      ])
      const cycles = findCycles(graph)
      assert.equal(cycles.length, 1)
      assert.deepEqual(new Set(cycles[0]), new Set(['a', 'b', 'c']))
    })

    await t.test('detects multiple disjoint cycles separately', () => {
      const graph = new Map([
        ['a', new Set(['b'])],
        ['b', new Set(['a'])],
        ['x', new Set(['y'])],
        ['y', new Set(['x'])]
      ])
      const cycles = findCycles(graph)
      assert.equal(cycles.length, 2)
    })

    await t.test('does not report a lone self-loop as a cycle', () => {
      const graph = new Map([['a', new Set(['a'])]])
      assert.deepEqual(findCycles(graph), [])
    })

    await t.test('does not get confused by a shared, non-cyclic dependency', () => {
      const graph = new Map([
        ['a', new Set(['b', 'c'])],
        ['b', new Set(['d'])],
        ['c', new Set(['d'])],
        ['d', new Set()]
      ])
      assert.deepEqual(findCycles(graph), [])
    })
  })

  await t.test('resolveRequireTarget', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = { dir: fs.mkdtempSync(path.join(os.tmpdir(), 'circular-deps-')) }
    })

    t.afterEach((ctx) => {
      fs.rmSync(ctx.nr.dir, { recursive: true, force: true })
    })

    await t.test('resolves a relative require with an explicit extension', (t) => {
      const { dir } = t.nr
      writeFixture(dir, { 'a.js': '', 'b.js': '' })
      const target = resolveRequireTarget(path.join(dir, 'a.js'), './b.js', dir, {})
      assert.equal(target, path.join(dir, 'b.js'))
    })

    await t.test('resolves a relative require missing its extension', (t) => {
      const { dir } = t.nr
      writeFixture(dir, { 'a.js': '', 'b.js': '' })
      const target = resolveRequireTarget(path.join(dir, 'a.js'), './b', dir, {})
      assert.equal(target, path.join(dir, 'b.js'))
    })

    await t.test('resolves a relative require to a directory index.js', (t) => {
      const { dir } = t.nr
      writeFixture(dir, { 'a.js': '', 'b/index.js': '' })
      const target = resolveRequireTarget(path.join(dir, 'a.js'), './b', dir, {})
      assert.equal(target, path.join(dir, 'b', 'index.js'))
    })

    await t.test('resolves a package.json#imports subpath mapping', (t) => {
      const { dir } = t.nr
      writeFixture(dir, { 'a.js': '', 'lib/b.js': '' })
      const importsMap = { '#agentlib/*.js': './lib/*.js' }
      const target = resolveRequireTarget(path.join(dir, 'a.js'), '#agentlib/b.js', dir, importsMap)
      assert.equal(target, path.join(dir, 'lib', 'b.js'))
    })

    await t.test('returns null for a subpath specifier with no matching pattern', (t) => {
      const { dir } = t.nr
      writeFixture(dir, { 'a.js': '' })
      const target = resolveRequireTarget(path.join(dir, 'a.js'), '#unknown/b.js', dir, {})
      assert.equal(target, null)
    })

    await t.test('returns null for a bare external specifier', (t) => {
      const { dir } = t.nr
      writeFixture(dir, { 'a.js': '' })
      const target = resolveRequireTarget(path.join(dir, 'a.js'), 'lodash', dir, {})
      assert.equal(target, null)
    })

    await t.test('returns null when nothing on disk matches', (t) => {
      const { dir } = t.nr
      writeFixture(dir, { 'a.js': '' })
      const target = resolveRequireTarget(path.join(dir, 'a.js'), './does-not-exist', dir, {})
      assert.equal(target, null)
    })
  })

  await t.test('findCircularDeps', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = { dir: fs.mkdtempSync(path.join(os.tmpdir(), 'circular-deps-')) }
    })

    t.afterEach((ctx) => {
      fs.rmSync(ctx.nr.dir, { recursive: true, force: true })
    })

    await t.test('reports no cycles for acyclic requires', (t) => {
      const { dir } = t.nr
      writeFixture(dir, {
        'package.json': '{}',
        'lib/a.js': "module.exports = require('./b.js')",
        'lib/b.js': 'module.exports = {}'
      })
      const cycles = findCircularDeps(path.join(dir, 'lib'), dir)
      assert.deepEqual(cycles, [])
    })

    await t.test('detects a cycle formed by plain relative requires', (t) => {
      const { dir } = t.nr
      writeFixture(dir, {
        'package.json': '{}',
        'lib/a.js': "const b = require('./b.js'); module.exports = { b }",
        'lib/b.js': "const a = require('./a.js'); module.exports = { a }"
      })
      const cycles = findCircularDeps(path.join(dir, 'lib'), dir)
      assert.equal(cycles.length, 1)
      assert.equal(cycles[0].length, 2)
    })

    await t.test('detects a cycle formed via a package.json#imports subpath', (t) => {
      const { dir } = t.nr
      writeFixture(dir, {
        'package.json': JSON.stringify({ imports: { '#agentlib/*.js': './lib/*.js' } }),
        'lib/a.js': "const b = require('./b.js'); module.exports = { b }",
        'lib/b.js': "const a = require('#agentlib/a.js'); module.exports = { a }"
      })
      const cycles = findCircularDeps(path.join(dir, 'lib'), dir)
      assert.equal(cycles.length, 1)
      assert.equal(cycles[0].length, 2)
    })

    await t.test('ignores requires to external packages and node: built-ins', (t) => {
      const { dir } = t.nr
      writeFixture(dir, {
        'package.json': '{}',
        'lib/a.js': "const util = require('node:util'); const lodash = require('lodash'); module.exports = { util, lodash }"
      })
      const cycles = findCircularDeps(path.join(dir, 'lib'), dir)
      assert.deepEqual(cycles, [])
    })

    await t.test('walks nested subdirectories under scanDir', (t) => {
      const { dir } = t.nr
      writeFixture(dir, {
        'package.json': '{}',
        'lib/nested/deep/a.js': "const b = require('../../b.js'); module.exports = { b }",
        'lib/b.js': "const a = require('./nested/deep/a.js'); module.exports = { a }"
      })
      const cycles = findCircularDeps(path.join(dir, 'lib'), dir)
      assert.equal(cycles.length, 1)
      assert.equal(cycles[0].length, 2)
    })
  })
})
