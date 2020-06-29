/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')

tap.test('should apply transaction name as active span intrinsic on transaction end', (t) => {
  let agent = helper.instrumentMockedAgent({
    distributed_tracing: {
      enabled: true
    }
  })

  t.tearDown(() => {
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

      t.equal(intrinsics['transaction.name'], transaction.name)

      t.end()
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
