/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { parsePath, queryParser } = require('../../../lib/instrumentation/@elastic/elasticsearch')
const methods = [
  { name: 'GET', expected: 'get' },
  { name: 'PUT', expected: 'create' },
  { name: 'POST', expected: 'create' },
  { name: 'DELETE', expected: 'delete' },
  { name: 'HEAD', expected: 'exists' }
]

tap.test('parsePath should behave as expected', (t) => {
  t.autoend()

  t.test('indices', function (t) {
    const path = '/indexName'
    methods.forEach((m) => {
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = `index.${m.expected}`
      t.equal(collection, 'indexName', `index should be 'indexName'`)
      t.equal(operation, expectedOp, 'operation should include index and method')
    })
    t.end()
  })
  t.test('search of one index', function (t) {
    const path = '/indexName/_search'
    methods.forEach((m) => {
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = `search`
      t.equal(collection, 'indexName', `index should be 'indexName'`)
      t.equal(operation, expectedOp, `operation should be 'search'`)
    })
    t.end()
  })
  t.test('search of all indices', function (t) {
    const path = '/_search/'
    methods.forEach((m) => {
      if (m.name === 'PUT') {
        // skip PUT
        return
      }
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = `search`
      t.equal(collection, 'any', 'index should be `any`')
      t.equal(operation, expectedOp, `operation should match ${expectedOp}`)
    })
    t.end()
  })
  t.test('doc', function (t) {
    const path = '/indexName/_doc/testKey'
    methods.forEach((m) => {
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = `doc.${m.expected}`
      t.equal(collection, 'indexName', `index should be 'indexName'`)
      t.equal(operation, expectedOp, `operation should match ${expectedOp}`)
    })
    t.end()
  })
  t.test('path is /', function (t) {
    const path = '/'
    methods.forEach((m) => {
      const { collection, operation } = parsePath(path, m.name)
      const expectedOp = `index.${m.expected}`
      t.equal(collection, 'any', 'index should be `any`')
      t.equal(operation, expectedOp, `operation should match ${expectedOp}`)
    })
    t.end()
  })
  t.test(
    'should provide sensible defaults when path is {} and parser encounters an error',
    function (t) {
      const path = {}
      methods.forEach((m) => {
        const { collection, operation } = parsePath(path, m.name)
        const expectedOp = `unknown`
        t.equal(collection, 'any', 'index should be `any`')
        t.equal(operation, expectedOp, `operation should match '${expectedOp}'`)
      })
      t.end()
    }
  )
})

tap.test('queryParser should behave as expected', (t) => {
  t.autoend()
  t.test('given a querystring, it should use that for query', (t) => {
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
    t.match(parseParams, expected, 'queryParser should handle query strings')
    t.end()
  })
  t.test('given a body, it should use that for query', (t) => {
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
    t.match(parseParams, expected, 'queryParser should handle query body')
    t.end()
  })
  t.test('given a bulkBody, it should use that for query', (t) => {
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
      operation: 'msearch',
      query: JSON.stringify([
        {}, // cross-index searches have can have an empty metadata section
        { query: { match: { body: 'sixth' } } },
        {},
        { query: { match: { body: 'bulk' } } }
      ])
    }
    const parseParams = queryParser(params)
    t.match(parseParams, expected, 'queryParser should handle query body')
    t.end()
  })
})
