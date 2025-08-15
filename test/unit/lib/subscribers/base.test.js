/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const Subscriber = require('#agentlib/subscribers/base.js')
const helper = require('#testlib/agent_helper.js')
const loggerMock = require('../../mocks/logger')
const { tspl } = require('@matteo.collina/tspl')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const subscriber = new Subscriber({ agent, logger, packageName: 'test-package', channelName: 'test-channel' })
  ctx.nr = { agent, subscriber }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should define default properties to subscriber', (t) => {
  const { subscriber } = t.nr
  assert.ok(subscriber.agent)
  assert.ok(subscriber.logger)
  assert.ok(subscriber.config)
  assert.equal(subscriber.packageName, 'test-package')
  assert.equal(subscriber.channelName, 'test-channel')
  assert.deepEqual(subscriber.events, [])
  assert.equal(subscriber.opaque, false)
  assert.equal(subscriber.prefix, 'orchestrion:')
  assert.equal(subscriber.requireActiveTx, true)
  assert.equal(subscriber.id, 'orchestrion:test-package:test-channel')
  assert.ok(subscriber.channel)
  assert.ok(subscriber.store)
})

test('addAttributes should not crash', (t) => {
  const { subscriber } = t.nr
  assert.doesNotThrow(() => {
    subscriber.addAttributes({})
  })
})

test('enabled should return true if package is enabled', (t) => {
  const { subscriber } = t.nr
  subscriber.config.instrumentation['test-package'] = { enabled: true }
  assert.equal(subscriber.enabled, true)
})

test('enabled should return false if package is not enabled', (t) => {
  const { subscriber } = t.nr
  subscriber.config.instrumentation['test-package'] = { enabled: false }
  assert.equal(subscriber.enabled, false)
})

test('should create segment if active tx with proper parent', async (t) => {
  const { agent, subscriber } = t.nr
  const plan = tspl(t, { plan: 7 })
  subscriber.addAttributes = (segment) => {
    plan.equal(segment.name, 'test-segment')
  }
  helper.runInTransaction(agent, async () => {
    const ctx = agent.tracer.getContext()
    const newCtx = subscriber.createSegment({
      name: 'test-segment',
      ctx,
    })

    plan.ok(newCtx)
    plan.equal(newCtx.transaction.id, ctx.transaction.id)
    const segment = newCtx.segment
    plan.equal(segment.name, 'test-segment')
    plan.equal(segment.parentId, ctx.segment.id)
    plan.equal(segment.opaque, false)
    // indicates that the segment timer is running
    plan.equal(segment.timer.state, 2)
  })

  await plan.completed
})

test('should not create segment if no active tx', (t) => {
  const { agent, subscriber } = t.nr
  const ctx = agent.tracer.getContext()
  const newCtx = subscriber.createSegment({
    name: 'test-segment',
    ctx,
  })

  assert.deepEqual(newCtx, ctx)
  assert.ok(!newCtx.segment)
})

test('should touch segment when asyncEnd is called', (t, end) => {
  const { agent, subscriber } = t.nr
  helper.runInTransaction(agent, () => {
    const ctx = agent.tracer.getContext()
    const segment = ctx.segment
    assert.equal(segment.timer.state, 2)
    assert.equal(segment.timer.touched, false)
    subscriber.asyncEnd()
    assert.equal(segment.timer.state, 2)
    assert.equal(segment.timer.touched, true)
    end()
  })
})

test('should subscribe/unsubscribe to specific events on channel', (t) => {
  const { subscriber } = t.nr
  subscriber.bogus = () => {}
  subscriber.start = () => {}
  subscriber.end = () => {}
  subscriber.events = ['bogus', 'start', 'end']
  subscriber.subscribe()
  assert.equal(subscriber.channel.start.hasSubscribers, true)
  assert.equal(subscriber.channel.end.hasSubscribers, true)
  assert.ok(!subscriber.channel.bogus)
  assert.ok(subscriber.subscriptions.bogus)
  assert.ok(subscriber.subscriptions.start)
  assert.ok(subscriber.subscriptions.end)
  subscriber.unsubscribe()
  assert.equal(subscriber.channel.start.hasSubscribers, false)
  assert.equal(subscriber.channel.end.hasSubscribers, false)
  assert.ok(!subscriber.channel.bogus)
  assert.equal(subscriber.subscriptions, null)
})
