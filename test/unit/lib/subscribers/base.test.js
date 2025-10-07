/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const Subscriber = require('#agentlib/subscribers/base.js')
const helper = require('#testlib/agent_helper.js')
const loggerMock = require('../../mocks/logger')
const { tspl } = require('@matteo.collina/tspl')
const hashes = require('#agentlib/util/hashes.js')

// Used for insertDTHeaders tests below
function setupCATConfig(subscriber) {
  subscriber.config.cross_application_tracer.enabled = true
  subscriber.config.distributed_tracing.enabled = false
  const key = 'this is an encoding key'
  subscriber.config.encoding_key = key
  subscriber.config.obfuscatedId = hashes.obfuscateNameUsingKey('1234#4321', key)
}

function setupDTConfig(subscriber) {
  subscriber.config.cross_application_tracer.enabled = false
  subscriber.config.distributed_tracing.enabled = true
}

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const subscriber = new Subscriber({ agent, logger, packageName: 'test-package', channelName: 'test-channel' })
  ctx.nr = { agent, subscriber }
})

test.afterEach((ctx) => {
  const { subscriber } = ctx.nr
  subscriber.disable()
  if (subscriber.subscriptions) {
    subscriber.unsubscribe()
  }
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

test('should not create segment if parent is opaque', async (t) => {
  const { agent, subscriber } = t.nr
  await helper.runInTransaction(agent, async () => {
    const ctx = agent.tracer.getContext()
    ctx.segment.opaque = true
    const newCtx = subscriber.createSegment({
      name: 'test-segment',
      ctx,
    })

    assert.deepEqual(newCtx, ctx)
    assert.equal(newCtx.segment.name, ctx.segment.name)
  })
})

test('should not create segment if parent is of same package and subscriber is internal', async (t) => {
  const { agent, subscriber } = t.nr
  await helper.runInTransaction(agent, async () => {
    const ctx = agent.tracer.getContext()
    ctx.segment.shimId = 'test-package'
    subscriber.internal = true
    const newCtx = subscriber.createSegment({
      name: 'test-segment',
      ctx,
    })

    assert.deepEqual(newCtx, ctx)
    assert.equal(newCtx.segment.name, ctx.segment.name)
  })
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

test('should call handler in start if transaction is active and create a new segment', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, subscriber } = t.nr
  const name = 'test-segment'
  subscriber.enable()
  subscriber.handler = function handler(data, ctx) {
    plan.equal(data.name, name)
    return subscriber.createSegment({
      name: data?.name,
      ctx
    })
  }

  helper.runInTransaction(agent, () => {
    const event = { name, moduleVersion: '1.0.0' }
    subscriber.channel.start.runStores(event, () => {
      const ctx = agent.tracer.getContext()
      plan.equal(ctx.segment.name, name)
      plan.ok(!event.transaction, 'transaction not added to event')
      plan.ok(!event.segment, 'segment not added to event')
    })
  })

  await plan.completed
})

test('should not call handler in start if transaction is not active and return existing context', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { agent, subscriber } = t.nr
  subscriber.enable()
  subscriber.handler = function handler() {
    plan.ok(0, 'should not call handler')
  }

  const event = {}
  subscriber.channel.start.runStores(event, (data) => {
    const ctx = agent.tracer.getContext()
    plan.ok(!ctx?.segment)
  })

  await plan.completed
})

test('should add transaction to event if propagateTx is true', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, subscriber } = t.nr
  subscriber.enable()
  subscriber.handler = function handler(data, ctx) {
    plan.ok(1, 'should not call handler')
    return ctx
  }
  subscriber.propagateTx = true

  helper.runInTransaction(agent, (tx) => {
    const event = {}
    subscriber.channel.start.runStores(event, () => {
      plan.equal(event.transaction.id, tx.id)
    })
  })

  await plan.completed
})

test('should bind callback and invoke asyncStart/asyncEnd events', async (t) => {
  const plan = tspl(t, { plan: 8 })
  const { agent, subscriber } = t.nr
  const name = 'test-segment'
  const expectedResult = 'test-result'
  subscriber.callback = -1
  subscriber.enable()
  subscriber.error = (err) => {
    plan.ifError(err)
  }
  subscriber.events = ['asyncStart', 'asyncEnd', 'error']
  subscriber.subscribe()
  subscriber.handler = function handler(data, ctx) {
    plan.equal(data.name, name)
    return subscriber.createSegment({
      name: data?.name,
      ctx
    })
  }

  function testCb(err, result) {
    plan.equal(result, expectedResult)
    plan.equal(err, null)
  }

  helper.runInTransaction(agent, () => {
    const event = { name, arguments: [testCb] }
    subscriber.channel.start.runStores(event, () => {
      const touchSpy = sinon.spy(event.segment, 'touch')
      const ctx = agent.tracer.getContext()
      plan.equal(ctx.segment.name, name)
      plan.equal(event.segment.timer.touched, false)
      plan.equal(event.segment.name, name, 'segment not added to event')
      event.arguments[0](null, expectedResult)
      plan.equal(touchSpy.callCount, 2, 'should call touch in asyncStart and asyncEnd')
      plan.equal(event.segment.timer.touched, true)
    })
  })

  await plan.completed
})

test('should bind callback and invoke the asyncStart/error/asyncError events when callback fails', async (t) => {
  const plan = tspl(t, { plan: 9 })
  const { agent, subscriber } = t.nr
  const name = 'test-segment'
  const expectedErr = new Error('cb failed')
  subscriber.callback = -1
  subscriber.error = (data) => {
    plan.equal(data.callback, true)
    plan.deepEqual(data.error, expectedErr)
  }
  subscriber.enable()
  subscriber.events = ['asyncStart', 'asyncEnd', 'error']
  subscriber.subscribe()
  subscriber.handler = function handler(data, ctx) {
    plan.equal(data.name, name)
    return subscriber.createSegment({
      name: data?.name,
      ctx
    })
  }

  function testCb(err, result) {
    plan.deepEqual(err, expectedErr)
    plan.equal(result, undefined)
  }

  helper.runInTransaction(agent, () => {
    const event = { name, arguments: [testCb] }
    subscriber.channel.start.runStores(event, () => {
      const ctx = agent.tracer.getContext()
      plan.equal(ctx.segment.name, name)
      plan.equal(event.segment.timer.touched, false)
      plan.equal(event.segment.name, name, 'segment not added to event')
      event.arguments[0](expectedErr)
      plan.equal(event.segment.timer.touched, true)
    })
  })

  await plan.completed
})

test('should not wrap callback if position is not a function thus not touching segment in asyncStart/asyncEnd', async (t) => {
  const plan = tspl(t, { plan: 7 })
  const { agent, subscriber } = t.nr
  const name = 'test-segment'
  subscriber.callback = 0
  subscriber.enable()
  subscriber.events = ['asyncStart', 'asyncEnd']
  subscriber.subscribe()
  subscriber.handler = function handler(data, ctx) {
    plan.equal(data.name, name)
    return subscriber.createSegment({
      name: data?.name,
      ctx
    })
  }

  function testCb(err, result) {
    plan.deepEqual(err, null)
    plan.equal(result, 'data')
  }

  helper.runInTransaction(agent, () => {
    const event = { name, arguments: ['string', testCb] }
    subscriber.channel.start.runStores(event, () => {
      const ctx = agent.tracer.getContext()
      plan.equal(ctx.segment.name, name)
      plan.equal(event.segment.timer.touched, false)
      plan.equal(event.segment.name, name, 'segment not added to event')
      event.arguments[1](null, 'data')
      plan.equal(event.segment.timer.touched, false)
    })
  })

  await plan.completed
})

test('should not run if disabled', function (t, end) {
  const { agent, subscriber } = t.nr
  subscriber.config.cross_application_tracer.enabled = false
  subscriber.config.distributed_tracing.enabled = false
  helper.runInTransaction(agent, function () {
    const headers = {}
    const ctx = agent.tracer.getContext()

    subscriber.insertDTHeaders({ ctx, headers })

    assert.ok(!headers.NewRelicID)
    assert.ok(!headers.NewRelicTransaction)
    assert.ok(!headers['X-NewRelic-Id'])
    assert.ok(!headers['X-NewRelic-Transaction'])
    end()
  })
})

test('should not run if the encoding key is missing', function (t, end) {
  const { agent, subscriber } = t.nr
  subscriber.config.cross_application_tracer.enabled = true
  subscriber.config.distributed_tracing.enabled = false
  helper.runInTransaction(agent, function () {
    const headers = {}
    const ctx = agent.tracer.getContext()

    subscriber.insertDTHeaders({ ctx, headers })

    assert.ok(!headers.NewRelicID)
    assert.ok(!headers.NewRelicTransaction)
    assert.ok(!headers['X-NewRelic-Id'])
    assert.ok(!headers['X-NewRelic-Transaction'])
    end()
  })
})

test('should fail gracefully when no headers are given', function (t) {
  const { agent, subscriber } = t.nr
  setupCATConfig(subscriber)
  helper.runInTransaction(agent, function () {
    assert.doesNotThrow(function () {
      subscriber.insertDTHeaders()
    })
  })
})

test(
  'should use MessageQueueStyleHeaders',
  function (t, end) {
    const { agent, subscriber } = t.nr
    setupCATConfig(subscriber)
    helper.runInTransaction(agent, function () {
      const headers = {}
      const ctx = agent.tracer.getContext()
      subscriber.insertDTHeaders({ ctx, headers, useMqNames: true })

      assert.ok(!headers['X-NewRelic-Id'])
      assert.ok(!headers['X-NewRelic-Transaction'])
      assert.equal(headers.NewRelicID, 'RVpaRwNdQBJQ')
      assert.match(headers.NewRelicTransaction, /^[a-zA-Z0-9/-]{60,80}={0,2}$/)
      end()
    })
  }
)

test(
  'should append the current path hash to the transaction - DT disabled',
  function (t, end) {
    const { agent, subscriber } = t.nr
    setupCATConfig(subscriber)
    helper.runInTransaction(agent, function (tx) {
      tx.nameState.appendPath('foobar')
      assert.equal(tx.pathHashes.length, 0)

      const headers = {}
      const ctx = agent.tracer.getContext()
      subscriber.insertDTHeaders({ ctx, headers })

      assert.equal(tx.pathHashes.length, 1)
      assert.equal(tx.pathHashes[0], '0f9570a6')
      end()
    })
  }
)

test('should be an obfuscated value - DT disabled, id header', function (t, end) {
  const { agent, subscriber } = t.nr
  setupCATConfig(subscriber)
  helper.runInTransaction(agent, function () {
    const headers = {}
    const ctx = agent.tracer.getContext()
    subscriber.insertDTHeaders({ ctx, headers })

    assert.match(headers['X-NewRelic-Id'], /^[a-zA-Z0-9/-]+={0,2}$/)
    end()
  })
})

test('should deobfuscate to the app id - DT disabled, id header', function (t, end) {
  const { agent, subscriber } = t.nr
  setupCATConfig(subscriber)
  helper.runInTransaction(agent, function () {
    const headers = {}
    const ctx = agent.tracer.getContext()
    subscriber.insertDTHeaders({ ctx, headers })

    const id = hashes.deobfuscateNameUsingKey(
      headers['X-NewRelic-Id'],
      subscriber.config.encoding_key
    )
    assert.equal(id, '1234#4321')
    end()
  })
})

test(
  'should be an obfuscated value - DT disabled, transaction header',
  function (t, end) {
    const { agent, subscriber } = t.nr
    setupCATConfig(subscriber)
    helper.runInTransaction(agent, function () {
      const headers = {}
      const ctx = agent.tracer.getContext()
      subscriber.insertDTHeaders({ ctx, headers })

      assert.match(headers['X-NewRelic-Transaction'], /^[a-zA-Z0-9/-]{60,80}={0,2}$/)
      end()
    })
  }
)

test(
  'should deobfuscate to transaction information - DT disabled, transaction header',
  function (t, end) {
    const { agent, subscriber } = t.nr
    setupCATConfig(subscriber)
    helper.runInTransaction(agent, function () {
      const headers = {}
      const ctx = agent.tracer.getContext()
      subscriber.insertDTHeaders({ ctx, headers })

      let txInfo = hashes.deobfuscateNameUsingKey(
        headers['X-NewRelic-Transaction'],
        subscriber.config.encoding_key
      )

      assert.doesNotThrow(function () {
        txInfo = JSON.parse(txInfo)
      })

      assert.ok(Array.isArray(txInfo))
      assert.equal(txInfo.length, 4)
      end()
    })
  }
)

test(
  'should assign traceparent header to transaction when tx is not sampled',
  function (t, end) {
    const { agent, subscriber } = t.nr
    setupDTConfig(subscriber)
    helper.runInTransaction(agent, function (tx) {
      const headers = {}
      const ctx = agent.tracer.getContext()
      subscriber.insertDTHeaders({ ctx, headers })
      assert.equal(headers.traceparent, `00-${tx.traceId}-${ctx?.segment.id}-00`)
      end()
    })
  }
)

test(
  'should assign traceparent header to transaction when tx is sampled',
  function (t, end) {
    const { agent, subscriber } = t.nr
    setupDTConfig(subscriber)
    helper.runInTransaction(agent, function (tx) {
      tx.sampled = true
      const headers = {}
      const ctx = agent.tracer.getContext()
      subscriber.insertDTHeaders({ ctx, headers })
      assert.equal(headers.traceparent, `00-${tx.traceId}-${ctx?.segment.id}-01`)
      end()
    })
  }
)
