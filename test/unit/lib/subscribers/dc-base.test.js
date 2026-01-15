/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const dc = require('node:diagnostics_channel')

const loggerMock = require('../../mocks/logger')
const helper = require('#testlib/agent_helper.js')
const Subscriber = require('#agentlib/subscribers/dc-base.js')

const PROCESS_MAJOR = require('../../../../package.json').version.split('.')[0]

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const subscriber = new Subscriber({
    agent,
    logger,
    packageName: 'test-package'
  })
  ctx.nr = { agent, subscriber }
})

test.afterEach((ctx) => {
  const { subscriber } = ctx.nr
  subscriber.disable()
  subscriber.unsubscribe()
  helper.unloadAgent(ctx.nr.agent)
})

test('records supportability metric on first usage', (t) => {
  t.plan(5)
  const { agent, subscriber } = t.nr

  let invocations = 0
  const metricNameBase = 'Supportability/Features/Instrumentation/SubscriberUsed/test-package'
  const chan = dc.channel('test.channel')
  subscriber.channels = [
    { channel: 'test.channel', hook: handler }
  ]
  subscriber.subscribe()

  chan.publish({ foo: 'foo' })

  function handler () {
    invocations += 1
    t.assert.equal(agent.metrics._metrics.unscoped[metricNameBase].callCount, 1)
    t.assert.equal(
      agent.metrics._metrics.unscoped[`${metricNameBase}/${PROCESS_MAJOR}`].callCount,
      1
    )

    if (invocations === 1) {
      chan.publish({ bar: 'bar' })
      const cachedChan = subscriber.channels[0]
      const keys = Object.keys(cachedChan).sort()
      t.assert.deepStrictEqual(
        keys,
        ['boundHook', 'channel', 'eventHandler', 'hook'],
        'attaches required properties to cached channel'
      )
    }
  }
})
