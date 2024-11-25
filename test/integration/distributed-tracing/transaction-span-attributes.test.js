/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')

test('should apply transaction name as active span intrinsic on transaction end', (t, end) => {
  const agent = helper.instrumentMockedAgent({
    distributed_tracing: {
      enabled: true
    }
  })

  t.after(() => {
    helper.unloadAgent(agent)
  })

  helper.runInTransaction(agent, (transaction) => {
    // forces a web transaction
    transaction.type = 'web'
    transaction.url = '/some/test/url'
    transaction.statusCode = 200

    // forces creation of spans
    transaction.priority = 42
    transaction.sampled = true

    setTimeout(() => {
      const segment = agent.tracer.getSegment()

      transaction.end()

      const span = findSpanByName(agent, segment.name)
      const serialized = span.toJSON()

      const [intrinsics] = serialized

      assert.equal(intrinsics['transaction.name'], transaction.name)

      end()
    }, 10)
  })
})

function findSpanByName(agent, name) {
  const spans = agent.spanEventAggregator.getEvents()

  for (const [, span] of spans.entries()) {
    if (span.intrinsics.name === name) {
      return span
    }
  }
}
