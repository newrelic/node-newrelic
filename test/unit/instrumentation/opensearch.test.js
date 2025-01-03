/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const {
  parsePath,
  queryParser
} = require('../../../lib/instrumentation/@opensearch-project/opensearch')
const instrumentation = require('../../../lib/instrumentation/@opensearch-project/opensearch')
const methods = [
  { name: 'GET', expected: 'get' },
  { name: 'PUT', expected: 'create' },
  { name: 'POST', expected: 'create' },
  { name: 'DELETE', expected: 'delete' },
  { name: 'HEAD', expected: 'exists' }
]

test('should log warning if version is not supported', async () => {
  const shim = {
    pkgVersion: '2.0.0',
    logger: {
      debug(msg) {
        assert.equal(
          msg,
          'Opensearch support is for versions 2.1.0 and above. Not instrumenting 2.0.0.'
        )
      }
    }
  }
  instrumentation({}, {}, '@opensearch-project/opensearch', shim)
})
test('parsePath should behave as expected', async (t) => {
  await t.test('indices', async function () {
    const path = '/indexName'
    methods.forEach((m) => {
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = `index.${m.expected}`
      assert.equal(collection, 'indexName', "index should be 'indexName'")
      assert.equal(operation, expectedOp, 'operation should include index and method')
    })
  })
  await t.test('search of one index', async function () {
    const path = '/indexName/_search'
    methods.forEach((m) => {
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = 'search'
      assert.equal(collection, 'indexName', "index should be 'indexName'")
      assert.equal(operation, expectedOp, "operation should be 'search'")
    })
  })
  await t.test('search of all indices', async function () {
    const path = '/_search/'
    methods.forEach((m) => {
      if (m.name === 'PUT') {
        // skip PUT
        return
      }
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = 'search'
      assert.equal(collection, 'any', 'index should be `any`')
      assert.equal(operation, expectedOp, `operation should match ${expectedOp}`)
    })
  })
  await t.test('doc', async function () {
    const path = '/indexName/_doc/testKey'
    methods.forEach((m) => {
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = `doc.${m.expected}`
      assert.equal(collection, 'indexName', "index should be 'indexName'")
      assert.equal(operation, expectedOp, `operation should match ${expectedOp}`)
    })
  })
  await t.test('path is /', async function () {
    const path = '/'
    methods.forEach((m) => {
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = `index.${m.expected}`
      assert.equal(collection, 'any', 'index should be `any`')
      assert.equal(operation, expectedOp, `operation should match ${expectedOp}`)
    })
  })
  await t.test(
    'should provide sensible defaults when path is {} and parser encounters an error',
    function () {
      const path = {}
      methods.forEach((m) => {
        const { collection, operation } = parsePath(path, m.name)
        const expectedOp = 'unknown'
        assert.equal(collection, 'any', 'index should be `any`')
        assert.equal(operation, expectedOp, `operation should match '${expectedOp}'`)
      })
    }
  )
})

test('queryParser should behave as expected', async (t) => {
  await t.test('given a querystring, it should use that for query', () => {
    const params = JSON.stringify({
      path: '/_search',
      method: 'GET',
      querystring: { q: 'searchterm' }
    })
    const expected = {
      collection: 'any',
      operation: 'search',
      query: JSON.stringify({ q: 'searchterm' })
    }
    const parseParams = queryParser(params)
    assert.deepEqual(parseParams, expected, 'queryParser should handle query strings')
  })
  await t.test('given a body, it should use that for query', () => {
    const params = JSON.stringify({
      path: '/_search',
      method: 'POST',
      body: { match: { body: 'document' } }
    })
    const expected = {
      collection: 'any',
      operation: 'search',
      query: JSON.stringify({ match: { body: 'document' } })
    }
    const parseParams = queryParser(params)
    assert.deepEqual(parseParams, expected, 'queryParser should handle query body')
  })
  await t.test('given a bulkBody, it should use that for query', () => {
    const params = JSON.stringify({
      path: '/_msearch',
      method: 'POST',
      bulkBody: [
        {}, // cross-index searches have can have an empty metadata section
        { query: { match: { body: 'sixth' } } },
        {},
        { query: { match: { body: 'bulk' } } }
      ]
    })
    const expected = {
      collection: 'any',
      operation: 'msearch.create',
      query: JSON.stringify([
        {}, // cross-index searches have can have an empty metadata section
        { query: { match: { body: 'sixth' } } },
        {},
        { query: { match: { body: 'bulk' } } }
      ])
    }
    const parseParams = queryParser(params)
    assert.deepEqual(parseParams, expected, 'queryParser should handle query body')
  })
})
