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

const { version: PKG_VERSION } = require('../../../../package.json')
const PROCESS_MAJOR = PKG_VERSION.split('.')[0]

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const subscriber = new Subscriber({
    agent,
    logger,
    packageName: 'test-package'
  })
  const testChannel = 'test.channel'
  ctx.nr = { agent, subscriber, testChannel, logger }
})

test.afterEach((ctx) => {
  const { subscriber } = ctx.nr
  subscriber.disable()
  subscriber.unsubscribe()
  helper.unloadAgent(ctx.nr.agent)
})

test('records supportability metric on first usage', (t) => {
  t.plan(9)
  const { agent, logger, subscriber, testChannel } = t.nr

  let invocations = 0
  const metricNameBase = 'Supportability/Features/Instrumentation/SubscriberUsed/test-package'
  const chan = dc.channel(testChannel)
  subscriber.channels = [
    { channel: testChannel, hook: handler }
  ]
  subscriber.subscribe()
  t.assert.equal(dc.hasSubscribers(testChannel), true)
  chan.publish({ foo: 'foo' })
  t.assert.equal(logger.warn.callCount, 0)
  t.assert.equal(dc.hasSubscribers(testChannel), true)

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
      t.assert.equal(dc.hasSubscribers(testChannel), true)
      t.assert.deepStrictEqual(
        keys,
        ['boundHook', 'channel', 'eventHandler', 'hook'],
        'attaches required properties to cached channel'
      )
    }
  }
})

test('should not call handler if provided versionRange is not satifisfied with actual package version', (t) => {
  const { logger, subscriber, testChannel } = t.nr
  // since we rely on the agent version, let's just specify an old version that will never be satisfied
  subscriber.versionRange = '<1.0.0'
  const ch = dc.channel(testChannel)
  subscriber.channels = [
    { channel: testChannel, hook: handler }
  ]
  subscriber.subscribe()
  t.assert.equal(dc.hasSubscribers(testChannel), true)

  ch.publish({ key: 'value' })
  t.assert.equal(dc.hasSubscribers(testChannel), false)

  function handler() {
    throw new Error('should not call handler')
  }

  t.assert.equal(logger.warn.callCount, 1)
  t.assert.equal(logger.warn.args[0][0], `Not instrumenting ${testChannel} as it is not within the supported version range ${subscriber.versionRange}, got ${PKG_VERSION}`)
})
