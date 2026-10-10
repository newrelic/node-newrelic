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

function fakeTransaction(names) {
  return {
    metrics: {
      getOrCreateMetric(name) {
        names.push(name)
        return { incrementCallCount() {} }
      }
    }
  }
}

test('flattenArgs flattens nested object args', (t) => {
  const { subscriber } = t.nr
  const flattened = subscriber.flattenArgs({
    obj: { book: { author: { name: 'George Orwell' }, title: '1984' } }
  })
  assert.deepEqual(flattened, {
    'book.author.name': 'George Orwell',
    'book.title': '1984'
  })
})

test('flattenArgs collapses a list of scalars under the arg name', (t) => {
  const { subscriber } = t.nr
  const flattened = subscriber.flattenArgs({ obj: { ids: [1, 2, 3] } })
  assert.deepEqual(flattened, { ids: 3 })
})

test('flattenArgs collapses a list of objects under the arg name', (t) => {
  const { subscriber } = t.nr
  const flattened = subscriber.flattenArgs({
    obj: { searchCriteria: [{ name: 'test' }, { name: 'test2' }] }
  })
  assert.deepEqual(flattened, { 'searchCriteria.name': 'test2' })
})

test('flattenArgs collapses lists nested inside object args', (t) => {
  const { subscriber } = t.nr
  const flattened = subscriber.flattenArgs({
    obj: { book: { ids: [1, 2], editions: [{ format: 'pb' }, { format: 'hb' }] } }
  })
  assert.deepEqual(flattened, { 'book.ids': 2, 'book.editions.format': 'hb' })
})

test('flattenArgs produces no keys for an empty list', (t) => {
  const { subscriber } = t.nr
  const flattened = subscriber.flattenArgs({ obj: { ids: [] } })
  assert.deepEqual(flattened, {})
})

test('captureFieldMetrics creates a single arg metric for a list of scalars', (t) => {
  const { subscriber } = t.nr
  const names = []
  const transaction = fakeTransaction(names)
  const args = subscriber.flattenArgs({ obj: { ids: [1, 2, 3] } })
  subscriber.captureFieldMetrics({ transaction, args, fieldType: 'Query', fieldName: 'books' })
  assert.deepEqual(names, [
    'GraphQL/field/ApolloServer/Query.books',
    'GraphQL/arg/ApolloServer/Query.books/ids'
  ])
})

test('captureFieldMetrics creates a single arg metric per leaf of a list of objects', (t) => {
  const { subscriber } = t.nr
  const names = []
  const transaction = fakeTransaction(names)
  const args = subscriber.flattenArgs({
    obj: { searchCriteria: [{ name: 'test' }, { name: 'test2' }] }
  })
  subscriber.captureFieldMetrics({ transaction, args, fieldType: 'Query', fieldName: 'books' })
  assert.deepEqual(names, [
    'GraphQL/field/ApolloServer/Query.books',
    'GraphQL/arg/ApolloServer/Query.books/searchCriteria.name'
  ])
})
