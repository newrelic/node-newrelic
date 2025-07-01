/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import path from 'node:path'
import url from 'node:url'
import * as td from 'testdouble'
import { readFileSync } from 'node:fs'

test.beforeEach(async (ctx) => {
  await td.replaceEsm('../../lib/instrumentation-subscribers.js', {}, [
    {
      channelName: 'unitTestEsm',
      module: { name: 'esm-pkg', versionRange: '>=1', filePath: 'foo.js' },
      operator: 'tracePromise',
      functionQuery: {
        className: 'Foo',
        methodName: 'doStuff',
        kind: 'Async'
      }
    },
    {
      channelName: 'unitTestCjs',
      module: { name: 'pkg-1', versionRange: '>=1', filePath: 'foo.js' },
      operator: 'tracePromise',
      functionQuery: {
        className: 'Foo',
        methodName: 'doStuff',
        kind: 'Async'
      }
    }

  ])

  let cjsPath
  let esmPath
  let unsubCjsPath
  let unsubEsmPath
  if (import.meta.dirname) {
    esmPath = path.join(import.meta.dirname, '../lib/example-deps/lib/node_modules/esm-pkg/foo.js')
    cjsPath = path.join(import.meta.dirname, '../lib/example-deps/lib/node_modules/pkg-1/foo.js')
    unsubCjsPath = path.join(import.meta.dirname, '../lib/example-deps/lib/node_modules/pkg-2/index.js')
    unsubEsmPath = path.join(import.meta.dirname, '../lib/example-deps/lib/node_modules/esm-pkg-2/index.js')
  } else {
    esmPath = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../lib/example-deps/lib/node_modules/esm-pkg/foo.js')
    cjsPath = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../lib/example-deps/lib/node_modules/pkg-1/foo.js')
    unsubCjsPath = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../lib/example-deps/lib/node_modules/pkg-2/index.js')
    unsubEsmPath = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../lib/example-deps/lib/node_modules/esm-pkg-2/index.js')
  }

  const resolveFn = async (specifier) => {
    if (specifier === 'esm-pkg') {
      return { url: `file://${esmPath}` }
    } else if (specifier === 'pkg-1') {
      return { url: `file://${cjsPath}` }
    } else if (specifier === 'pkg-2') {
      return { url: `file://${unsubCjsPath}` }
    } else {
      return { url: `file://${unsubEsmPath}` }
    }
  }
  const nextLoad = async (url, context) => {
    if (url.includes('pkg-1')) {
      const data = readFileSync(cjsPath, 'utf8')
      const response = {
        format: 'commonjs',
        source: data
      }
      if (context.responseUrl) {
        response.responseURL = url
      }

      return response
    } else if (url.includes('esm-pkg')) {
      const data = readFileSync(esmPath, 'utf8')
      return {
        format: 'module',
        source: data
      }
    } else if (url.includes('pkg-2')) {
      const data = readFileSync(unsubCjsPath, 'utf8')
      return {
        format: 'commonjs',
        source: data
      }
    } else {
      const data = readFileSync(unsubEsmPath, 'utf8')
      return {
        format: 'module',
        source: data
      }
    }
  }

  const esmLoaderRewriter = await import('../../esm-rewriter.mjs')

  ctx.nr = {
    nextLoad,
    resolveFn,
    esmLoaderRewriter
  }
})

test.afterEach(() => {
  td.reset()
})

test('should rewrite code if it matches a subscriber and esm module', async (t) => {
  const { esmLoaderRewriter, resolveFn, nextLoad } = t.nr
  const url = await esmLoaderRewriter.resolve('esm-pkg', {}, resolveFn)
  const result = await esmLoaderRewriter.load(url.url, {}, nextLoad)
  assert.equal(result.format, 'module')
  assert.equal(result.shortCircuit, true)
  assert.ok(result.source.includes('return tr_ch_apm$unitTestEsm.tracePromise(traced'))
})

test('should not rewrite code if it does not match a subscriber and a esm module', async (t) => {
  const { esmLoaderRewriter, resolveFn, nextLoad } = t.nr
  const url = await esmLoaderRewriter.resolve('esm-pkg-2', {}, resolveFn)
  const result = await esmLoaderRewriter.load(url.url, {}, nextLoad)
  assert.equal(result.format, 'module')
  assert.ok(!result.shortCircuit)
  assert.ok(!result.source.includes('return tr_ch_apm$unitTestEsm.tracePromise(traced'))
})

test('should rewrite code if it matches a subscriber and a cjs module', async (t) => {
  const { esmLoaderRewriter, resolveFn, nextLoad } = t.nr
  const url = await esmLoaderRewriter.resolve('pkg-1', {}, resolveFn)
  const result = await esmLoaderRewriter.load(url.url, {}, nextLoad)
  assert.equal(result.format, 'commonjs')
  assert.equal(result.shortCircuit, true)
  assert.ok(result.source.includes('return tr_ch_apm$unitTestCjs.tracePromise(traced'))
})

test('should rewrite code if it matches a subscriber and a cjs module', async (t) => {
  const { esmLoaderRewriter, resolveFn, nextLoad } = t.nr
  const url = await esmLoaderRewriter.resolve('pkg-1', {}, resolveFn)
  const result = await esmLoaderRewriter.load(url.url, { responseUrl: true }, nextLoad)
  assert.equal(result.format, 'commonjs')
  assert.equal(result.shortCircuit, true)
  assert.ok(result.source.includes('return tr_ch_apm$unitTestCjs.tracePromise(traced'))
})

test('should not rewrite code if it does not match a subscriber and a cjs module', async (t) => {
  const { esmLoaderRewriter, resolveFn, nextLoad } = t.nr
  const url = await esmLoaderRewriter.resolve('pkg-2', {}, resolveFn)
  const result = await esmLoaderRewriter.load(url.url, {}, nextLoad)
  assert.equal(result.format, 'commonjs')
  assert.ok(!result.shortCircuit)
  assert.ok(!result.source.includes('return tr_ch_apm$unitTestCjs.tracePromise(traced'))
})
