/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const BaseCoreSubscriber = require('#agentlib/subscribers/core/base.js')
const helper = require('#testlib/agent_helper.js')
const loggerMock = require('../../../mocks/logger')
const { tspl } = require('@matteo.collina/tspl')

// Minimal concrete subclass — instrument() must be implemented
class TestSubscriber extends BaseCoreSubscriber {
  instrument() {}
}

function makeSubscriber(agent, opts = {}) {
  const logger = loggerMock()
  return new TestSubscriber({
    agent,
    logger,
    packageName: 'dns',
    instrumentedMethods: opts.instrumentedMethods ?? ['lookup'],
    hasCallback: opts.hasCallback ?? false,
    prefix: opts.prefix,
  })
}

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const subscriber = makeSubscriber(agent)
  ctx.nr = { agent, subscriber }
})

test.afterEach((ctx) => {
  const { agent, subscriber } = ctx.nr
  subscriber.disable()
  subscriber.unsubscribe()
  helper.unloadAgent(agent)
})

test('should define default properties on subscriber', (t) => {
  const { agent, subscriber } = t.nr
  assert.ok(subscriber.agent)
  assert.ok(subscriber.config)
  assert.ok(subscriber.logger)
  assert.equal(subscriber.packageName, 'dns')
  assert.equal(subscriber.hasCallback, false)
  assert.equal(subscriber.id, 'nr:dns')
  assert.ok(Array.isArray(subscriber.channels))
  assert.equal(subscriber.channels.length, 1)
  assert.ok(subscriber.store)
  assert.equal(subscriber.store, agent.tracer.store)
  assert.ok(subscriber.handlers)
  assert.ok(typeof subscriber.handlers.asyncEnd, 'function')
})

test('should build id with prefix when prefix is provided', (t) => {
  const { agent } = t.nr
  const subscriber = makeSubscriber(agent, { prefix: 'core' })
  assert.equal(subscriber.id, 'nr:core:dns')
  subscriber.disable()
  subscriber.unsubscribe()
})

test('should build id without prefix when prefix is omitted', (t) => {
  const { subscriber } = t.nr
  assert.equal(subscriber.id, 'nr:dns')
})

test('should include end handler when hasCallback is true', (t) => {
  const { agent } = t.nr
  const subscriber = makeSubscriber(agent, { hasCallback: true })
  assert.ok(typeof subscriber.handlers.end, 'function')
  subscriber.disable()
  subscriber.unsubscribe()
})

test('should not include end handler when hasCallback is false', (t) => {
  const { subscriber } = t.nr
  assert.ok(!subscriber.handlers.end)
})

test('buildChannels should create one tracing channel per method name', (t) => {
  const { agent } = t.nr
  const subscriber = makeSubscriber(agent, { instrumentedMethods: ['lookup', 'resolve', 'resolve4'] })
  assert.equal(subscriber.channels.length, 3)
  subscriber.disable()
  subscriber.unsubscribe()
})

test('enabled should return true when package instrumentation is enabled', (t) => {
  const { subscriber } = t.nr
  subscriber.config.instrumentation['dns'].enabled = true
  assert.equal(subscriber.enabled, true)
})

test('enabled should return false when package instrumentation is disabled', (t) => {
  const { subscriber } = t.nr
  subscriber.config.instrumentation['dns'].enabled = false
  assert.equal(subscriber.enabled, false)
})

test('createSegment should create and start a child segment inside a transaction', async (t) => {
  const plan = tspl(t, { plan: 5 })
  const { agent, subscriber } = t.nr

  helper.runInTransaction(agent, async () => {
    const ctx = agent.tracer.getContext()
    const newCtx = subscriber.createSegment({ name: 'test-segment', ctx })

    plan.ok(newCtx)
    plan.equal(newCtx.transaction.id, ctx.transaction.id)
    const segment = newCtx.segment
    plan.equal(segment.name, 'test-segment')
    plan.equal(segment.parentId, ctx.segment.id)
    // state 2 means timer is running
    plan.equal(segment.timer.state, 2)
  })

  await plan.completed
})

test('createSegment should return original ctx when no active transaction', (t) => {
  const { agent, subscriber } = t.nr
  const ctx = agent.tracer.getContext()
  const newCtx = subscriber.createSegment({ name: 'test-segment', ctx })
  assert.deepEqual(newCtx, ctx)
  assert.ok(!newCtx.segment)
})

test('createSegment should accept a recorder option', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const { agent, subscriber } = t.nr
  const recorder = sinon.stub()

  helper.runInTransaction(agent, async (tx) => {
    const ctx = agent.tracer.getContext()
    const newCtx = subscriber.createSegment({ name: 'test-segment', recorder, ctx })
    plan.ok(newCtx)
    plan.equal(newCtx.segment.name, 'test-segment')
    // end tx to ensure recorder is called
    tx.end()
    plan.equal(recorder.callCount, 1)
  })

  await plan.completed
})

test('handler should call createSegment with data.name and ctx', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, subscriber } = t.nr

  helper.runInTransaction(agent, async () => {
    const ctx = agent.tracer.getContext()
    const spy = sinon.spy(subscriber, 'createSegment')
    subscriber.handler({ name: 'test-segment' }, ctx)
    plan.equal(spy.callCount, 1)
    plan.deepEqual(spy.firstCall.args[0], { name: 'test-segment', ctx })
  })

  await plan.completed
})

test('end should touch the current segment', (t, done) => {
  const { agent, subscriber } = t.nr

  helper.runInTransaction(agent, () => {
    const ctx = agent.tracer.getContext()
    const segment = ctx.segment
    assert.equal(segment.timer.touched, false)
    subscriber.end({})
    assert.equal(segment.timer.touched, true)
    done()
  })
})

test('end should not throw when there is no active context', (t) => {
  const { subscriber } = t.nr
  assert.doesNotThrow(() => {
    subscriber.end({})
  })
})

test('asyncEnd should touch the current segment', (t, done) => {
  const { agent, subscriber } = t.nr

  helper.runInTransaction(agent, () => {
    const ctx = agent.tracer.getContext()
    const segment = ctx.segment
    assert.equal(segment.timer.touched, false)
    subscriber.asyncEnd({})
    assert.equal(segment.timer.touched, true)
    done()
  })
})

test('asyncEnd should not throw when there is no active context', (t) => {
  const { subscriber } = t.nr
  assert.doesNotThrow(() => {
    subscriber.asyncEnd({})
  })
})

test('instrument should throw — subclasses must implement it', (t) => {
  const { agent } = t.nr
  const logger = loggerMock()
  const raw = new BaseCoreSubscriber({
    agent,
    logger,
    packageName: 'dns',
    instrumentedMethods: [],
  })
  assert.throws(() => raw.instrument({}), /Must implement instrument/)
})

test('subscribe should bind asyncEnd handler on all channels', (t) => {
  const { subscriber } = t.nr
  subscriber.subscribe()
  for (const channel of subscriber.channels) {
    assert.equal(channel.asyncEnd.hasSubscribers, true)
  }
})

test('subscribe should bind end handler when hasCallback is true', (t) => {
  const { agent } = t.nr
  const subscriber = makeSubscriber(agent, { hasCallback: true })
  subscriber.subscribe()
  for (const channel of subscriber.channels) {
    assert.equal(channel.end.hasSubscribers, true)
  }
  subscriber.disable()
  subscriber.unsubscribe()
})

test('unsubscribe should remove all channel handlers', (t) => {
  const { subscriber } = t.nr
  subscriber.subscribe()
  subscriber.unsubscribe()
  for (const channel of subscriber.channels) {
    assert.equal(channel.asyncEnd.hasSubscribers, false)
  }
})

test('enable should bind start store on all channels', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { agent, subscriber } = t.nr
  subscriber.enable()

  helper.runInTransaction(agent, () => {
    subscriber.channels[0].start.runStores({ name: 'lookup' }, () => {
      plan.ok(true, 'start store callback ran')
    })
  })

  await plan.completed
})

test('enable should call handler when transaction is active', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, subscriber } = t.nr
  const handlerStub = sinon.stub(subscriber, 'handler').callsFake((data, ctx) => {
    plan.equal(data.name, 'lookup')
    return ctx
  })
  subscriber.enable()

  helper.runInTransaction(agent, () => {
    subscriber.channels[0].start.runStores({ name: 'lookup' }, () => {
      plan.equal(handlerStub.callCount, 1)
    })
  })

  await plan.completed
})

test('enable should not call handler when no active transaction', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { subscriber } = t.nr
  const handlerStub = sinon.stub(subscriber, 'handler')
  subscriber.enable()

  subscriber.channels[0].start.runStores({ name: 'lookup' }, () => {
    plan.equal(handlerStub.callCount, 0)
  })

  await plan.completed
})

test('enable should log trace when skipping inactive transaction', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { subscriber } = t.nr
  subscriber.enable()

  subscriber.channels[0].start.runStores({ name: 'lookup' }, () => {
    plan.equal(subscriber.logger.trace.callCount, 1)
  })

  await plan.completed
})

test('enable should call instrument on the package', (t) => {
  const { subscriber } = t.nr
  const instrumentSpy = sinon.spy(subscriber, 'instrument')
  subscriber.enable()
  assert.equal(instrumentSpy.callCount, 1)
})

test('enable should log warning when instrument throws', (t) => {
  const { subscriber } = t.nr
  sinon.stub(subscriber, 'instrument').throws(new Error('bad instrument'))
  subscriber.enable()
  assert.equal(subscriber.logger.warn.callCount, 1)
})

test('disable should unbind start store on all channels', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { agent, subscriber } = t.nr
  subscriber.enable()
  subscriber.disable()

  helper.runInTransaction(agent, () => {
    const handlerStub = sinon.stub(subscriber, 'handler')
    subscriber.channels[0].start.runStores({ name: 'lookup' }, () => {
      plan.equal(handlerStub.callCount, 0)
    })
  })

  await plan.completed
})

test('handleCallback should bind asyncStart store on a channel', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, subscriber } = t.nr
  subscriber.enable()

  const channel = subscriber.channels[0]
  subscriber.handleCallback(channel)

  helper.runInTransaction(agent, () => {
    const event = { name: 'lookup', callbackName: 'onLookup' }
    channel.start.runStores(event, () => {
      channel.asyncStart.runStores(event, () => {
        const ctx = agent.tracer.getContext()
        plan.ok(ctx.segment)
        plan.equal(ctx.segment.name, 'Callback: onLookup')
      })
    })
  })

  await plan.completed
})

test('handleCallback should skip segment creation when transaction is inactive', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { subscriber } = t.nr
  subscriber.enable()

  const channel = subscriber.channels[0]
  subscriber.handleCallback(channel)

  const event = { name: 'lookup', callbackName: 'onLookup' }
  channel.asyncStart.runStores(event, () => {
    plan.equal(subscriber.logger.trace.callCount, 1)
  })

  await plan.completed
})

test('enable should call handleCallback for each channel when hasCallback is true', (t) => {
  const { agent } = t.nr
  const subscriber = makeSubscriber(agent, {
    hasCallback: true,
    instrumentedMethods: ['lookup', 'resolve'],
  })
  const handleCallbackSpy = sinon.spy(subscriber, 'handleCallback')
  subscriber.enable()
  assert.equal(handleCallbackSpy.callCount, 2)
  subscriber.disable()
  subscriber.unsubscribe()
})
