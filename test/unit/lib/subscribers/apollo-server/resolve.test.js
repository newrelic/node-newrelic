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
          incrementCallCount() {
            counts[name] = (counts[name] ?? 0) + 1
          }
        }
      }
    }
  }
  const args = subscriber.flattenArgs({ obj })
  subscriber.captureFieldMetrics({ transaction, args, fieldType: 'Query', fieldName: 'books' })
  return counts
}

test('captureFieldMetrics collapses list args into one metric per item', (t) => {
  const { subscriber } = t.nr
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
  const counts = captureArgMetrics(subscriber, { book: { author: { name: 'a' }, title: 'b' } })
  assert.deepEqual(counts, {
    'GraphQL/field/ApolloServer/Query.books': 1,
    'GraphQL/arg/ApolloServer/Query.books/book.author.name': 1,
    'GraphQL/arg/ApolloServer/Query.books/book.title': 1
  })
})
