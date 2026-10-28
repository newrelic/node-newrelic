/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const ApolloResolveSubscriber = require('#agentlib/subscribers/apollo-server/resolve.js')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = require('../../../mocks/logger')()
  const subscriber = new ApolloResolveSubscriber({ agent, logger })
  ctx.nr = {
    agent,
    subscriber
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

function captureArgMetrics(subscriber, obj) {
  const counts = {}
  const transaction = {
    metrics: {
      getOrCreateMetric(name) {
        return {
          incrementCallCount(count = 1) {
            counts[name] = (counts[name] ?? 0) + count
          }
        }
      }
    }
  }
  const collapse = subscriber.config.apollo_server.collapse_field_metrics
  const args = subscriber.flattenArgs({ obj, collapse })
  subscriber.captureFieldMetrics({ transaction, args, fieldType: 'Query', fieldName: 'books' })
  return counts
}

test('captureFieldMetrics keeps list indexes in arg names by default', (t) => {
  const { subscriber } = t.nr
  const counts = captureArgMetrics(subscriber, {
    ids: [1, 2],
    searchCriteria: [{ name: 'test' }]
  })
  assert.deepEqual(counts, {
    'GraphQL/field/ApolloServer/Query.books': 1,
    'GraphQL/arg/ApolloServer/Query.books/ids.0': 1,
    'GraphQL/arg/ApolloServer/Query.books/ids.1': 1,
    'GraphQL/arg/ApolloServer/Query.books/searchCriteria.0.name': 1
  })
})

test('captureFieldMetrics collapses list args into one metric per item', (t) => {
  const { subscriber } = t.nr
  subscriber.config.apollo_server.collapse_field_metrics = true
  const counts = captureArgMetrics(subscriber, {
    ids: [1, 2, 3],
    searchCriteria: [{ name: 'test' }, { name: 'test2' }]
  })
  assert.deepEqual(counts, {
    'GraphQL/field/ApolloServer/Query.books': 1,
    'GraphQL/arg/ApolloServer/Query.books/ids': 3,
    'GraphQL/arg/ApolloServer/Query.books/searchCriteria.name': 2
  })
})

test('captureFieldMetrics collapses nested lists', (t) => {
  const { subscriber } = t.nr
  subscriber.config.apollo_server.collapse_field_metrics = true
  const counts = captureArgMetrics(subscriber, {
    book: { editions: [{ formats: ['pb', 'hb'] }] },
    matrix: [[1], [2]]
  })
  assert.deepEqual(counts, {
    'GraphQL/field/ApolloServer/Query.books': 1,
    'GraphQL/arg/ApolloServer/Query.books/book.editions.formats': 2,
    'GraphQL/arg/ApolloServer/Query.books/matrix': 2
  })
})

test('captureFieldMetrics keeps non-list arg names unchanged', (t) => {
  const { subscriber } = t.nr
  subscriber.config.apollo_server.collapse_field_metrics = true
  const counts = captureArgMetrics(subscriber, { book: { author: { name: 'a' }, title: 'b' } })
  assert.deepEqual(counts, {
    'GraphQL/field/ApolloServer/Query.books': 1,
    'GraphQL/arg/ApolloServer/Query.books/book.author.name': 1,
    'GraphQL/arg/ApolloServer/Query.books/book.title': 1
  })
})

test('captureFieldMetrics does not collapse numeric keys of plain objects', (t) => {
  const { subscriber } = t.nr
  subscriber.config.apollo_server.collapse_field_metrics = true
  const counts = captureArgMetrics(subscriber, { lookup: { 2024: 'a', 2025: 'b' } })
  assert.deepEqual(counts, {
    'GraphQL/field/ApolloServer/Query.books': 1,
    'GraphQL/arg/ApolloServer/Query.books/lookup.2024': 1,
    'GraphQL/arg/ApolloServer/Query.books/lookup.2025': 1
  })
})

test('captureFieldMetrics counts args named after Object members', (t) => {
  const { subscriber } = t.nr
  subscriber.config.apollo_server.collapse_field_metrics = true
  const counts = captureArgMetrics(subscriber, { constructor: ['a', 'b'] })
  assert.deepEqual(counts, {
    'GraphQL/field/ApolloServer/Query.books': 1,
    'GraphQL/arg/ApolloServer/Query.books/constructor': 2
  })
})
