/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')

const EXTERNAL_NAME = /External\/newrelic.com(:443)*\//

tap.test('SuperAgent instrumentation', (t) => {
  t.beforeEach((t) => {
    t.context.agent = helper.instrumentMockedAgent()
    t.context.request = require('superagent')
  })
  t.afterEach((t) => {
    helper.unloadAgent(t.context.agent)
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('superagent')) {
        delete require.cache[key]
      }
    })
  })

  t.test('should maintain transaction context with callbacks', (t) => {
    const { agent, request } = t.context

    helper.runInTransaction(agent, (tx) => {
      request.get('https://newrelic.com', function testCallback() {
        t.ok(tx)

        const mainSegment = tx.trace.root.children[0]
        t.ok(mainSegment)
        t.match(mainSegment.name, EXTERNAL_NAME, 'has segment matching request')
        t.equal(
          mainSegment.children.filter((c) => c.name === 'Callback: testCallback').length,
          1,
          'has segment matching callback'
        )

        t.end()
      })
    })
  })

  t.test('should not create a segment for callback if not in transaction', (t) => {
    const { agent, request } = t.context
    request.get('https://newrelic.com', function testCallback() {
      t.notOk(agent.getTransaction(), 'should not have a transaction')
      t.end()
    })
  })

  t.test('should maintain transaction context with promises', (t) => {
    const { agent, request } = t.context
    helper.runInTransaction(agent, (tx) => {
      request.get('https://newrelic.com').then(function testThen() {
        t.ok(tx)

        const mainSegment = tx.trace.root.children[0]
        t.ok(mainSegment)
        t.match(mainSegment.name, EXTERNAL_NAME, 'has segment matching request')
        t.equal(
          mainSegment.children.filter((c) => c.name === 'Callback: <anonymous>').length,
          1,
          'has segment matching callback'
        )

        t.end()
      })
    })
  })

  t.test('should not create segment for a promise if not in a transaction', (t) => {
    const { agent, request } = t.context
    request.get('https://newrelic.com').then(function testThen() {
      t.notOk(agent.getTransaction(), 'should not have a transaction')
      t.end()
    })
  })

  t.end()
})
