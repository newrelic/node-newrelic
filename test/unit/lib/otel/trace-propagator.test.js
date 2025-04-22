/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const otel = require('@opentelemetry/api')
const NewRelicTracePropagator = require('#agentlib/otel/trace-propagator.js')
const { tspl } = require('@matteo.collina/tspl')
const sinon = require('sinon')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true
    }
  })
  ctx.nr = { agent }
  ctx.nr.carrier = {}
  ctx.nr.setter = {
    set(carrier, header, value) {
      carrier[header] = value
    }
  }
  ctx.nr.getter = {
    get: (carrier, key) => carrier[key]
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should set traceparent and tracestate on outgoing headers when otel root context is passed in', (t) => {
  sinon.stub(otel.trace, 'getSpanContext')
  t.after(() => {
    otel.trace.getSpanContext.restore()
  })
  const { agent, carrier, setter } = t.nr
  agent.config.trusted_account_key = 1
  agent.config.primary_application_id = 2
  agent.config.account_id = 1
  const propagation = new NewRelicTracePropagator(agent)
  helper.runInTransaction(agent, (tx) => {
    otel.trace.getSpanContext.callsFake(() => ({
      traceId: tx.traceId,
      spanId: tx.trace.root.id,
      traceFlags: otel.TraceFlags.SAMPLED
    }))

    propagation.inject(otel.ROOT_CONTEXT, carrier, setter)
    assert.equal(carrier.traceparent, `00-${tx.traceId}-${tx.trace.root.id}-01`)
    assert.equal(tx.isDistributedTrace, true)
    assert.ok(carrier.tracestate.startsWith(`1@nr=0-0-1-2-${tx.trace.root.id}-${tx.id}-1`))
    tx.end()
  })
})

test('should not set traceparent and tracestate on outgoing headers when distributed tracing is disabled', (t) => {
  const { agent, carrier, setter } = t.nr
  agent.config.distributed_tracing.enabled = false
  const propagation = new NewRelicTracePropagator(agent)
  helper.runInTransaction(agent, (tx) => {
    propagation.inject(otel.ROOT_CONTEXT, carrier, setter)
    assert.deepEqual(carrier, {})
    assert.ok(!tx.isDistributedTrace)
    tx.end()
  })
})

test('should not set traceparent/tracestate on outgoing headers when span context is not present', (t) => {
  sinon.stub(otel.trace, 'getSpanContext')
  t.after(() => {
    otel.trace.getSpanContext.restore()
  })
  const { agent, carrier, setter } = t.nr
  const propagation = new NewRelicTracePropagator(agent)
  otel.trace.getSpanContext.returns(null)
  propagation.inject(otel.ROOT_CONTEXT, carrier, setter)
  assert.deepEqual(carrier, {})
})

test('should return agent context when root context is passed in', async (t) => {
  const plan = tspl(t, { plan: 8 })
  const { agent, getter, carrier } = t.nr
  sinon.stub(otel.trace, 'setSpanContext')
  t.after(() => {
    otel.trace.setSpanContext.restore()
  })
  const propagation = new NewRelicTracePropagator(agent)
  const spanId = '00f067aa0ba902b7'
  const traceId = '00015f9f95352ad550284c27c5d3084c'
  const traceparent = `00-${traceId}-${spanId}-01`
  const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`

  otel.trace.setSpanContext.callsFake((context, spanContext) => {
    plan.equal(spanContext.isRemote, true)
    plan.equal(spanContext.spanId, spanId)
    plan.equal(spanContext.traceId, traceId)
    plan.equal(spanContext.traceFlags, 1)
    plan.equal(spanContext.traceState.state, tracestate)
    return context
  })

  carrier.traceparent = traceparent
  carrier.tracestate = tracestate
  const ctx = propagation.extract(otel.ROOT_CONTEXT, carrier, getter)
  plan.equal(ctx.transaction, undefined)
  plan.equal(ctx.segment, undefined)
  plan.ok(ctx._otelCtx)
  await plan.completed
})

test('should pick first traceparent if header is an array of values', async (t) => {
  const plan = tspl(t, { plan: 8 })
  const { agent, carrier, getter } = t.nr
  sinon.stub(otel.trace, 'setSpanContext')
  t.after(() => {
    otel.trace.setSpanContext.restore()
  })
  const propagation = new NewRelicTracePropagator(agent)
  const spanId = '00f067aa0ba902b7'
  const traceId = '00015f9f95352ad550284c27c5d3084c'
  const traceparent = `00-${traceId}-${spanId}-01`
  const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`

  otel.trace.setSpanContext.callsFake((context, spanContext) => {
    plan.equal(spanContext.isRemote, true)
    plan.equal(spanContext.spanId, spanId)
    plan.equal(spanContext.traceId, traceId)
    plan.equal(spanContext.traceFlags, 1)
    plan.equal(spanContext.traceState.state, tracestate)
    return context
  })

  carrier.traceparent = [traceparent, '00-0000dafdadf-adadfdasfdas-01']
  carrier.tracestate = tracestate
  const ctx = propagation.extract(otel.ROOT_CONTEXT, carrier, getter)
  plan.equal(ctx.transaction, undefined)
  plan.equal(ctx.segment, undefined)
  plan.ok(ctx._otelCtx)
  await plan.completed
})

test('should not propagate traceparent/tracestate if distributed_tracing is disabled', async (t) => {
  const spy = sinon.spy(otel.trace, 'setSpanContext')
  t.after(() => {
    spy.restore()
  })
  const { agent } = t.nr
  agent.config.distributed_tracing.enabled = false
  const propagation = new NewRelicTracePropagator(agent)
  const ctx = propagation.extract(otel.ROOT_CONTEXT, {})
  assert.equal(ctx.transaction, undefined)
  assert.equal(ctx.segment, undefined)
  assert.ok(ctx._otelCtx)
  assert.equal(spy.callCount, 0)
})

test('should not propagate if traceparent if it is not a string', async (t) => {
  const spy = sinon.spy(otel.trace, 'setSpanContext')
  t.after(() => {
    spy.restore()
  })
  const { agent, carrier, getter } = t.nr
  const propagation = new NewRelicTracePropagator(agent)
  const traceparent = true
  carrier.traceparent = traceparent
  const ctx = propagation.extract(otel.ROOT_CONTEXT, carrier, getter)
  assert.equal(ctx.transaction, undefined)
  assert.equal(ctx.segment, undefined)
  assert.ok(ctx._otelCtx)
  assert.equal(spy.callCount, 0)
})

test('should not propagate traceparent when it is malformed', (t) => {
  const spy = sinon.spy(otel.trace, 'setSpanContext')
  t.after(() => {
    spy.restore()
  })
  const { agent, carrier, getter } = t.nr
  const propagation = new NewRelicTracePropagator(agent)
  const traceparent = '00-garbage'
  carrier.traceparent = traceparent
  const ctx = propagation.extract(otel.ROOT_CONTEXT, carrier, getter)
  assert.equal(ctx.transaction, undefined)
  assert.equal(ctx.segment, undefined)
  assert.ok(ctx._otelCtx)
  assert.equal(spy.callCount, 0)
})

test('should not propagate traceparent when it contains extra fields', (t) => {
  const spy = sinon.spy(otel.trace, 'setSpanContext')
  t.after(() => {
    spy.restore()
  })
  const { agent, carrier, getter } = t.nr
  const propagation = new NewRelicTracePropagator(agent)
  const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01-extra'
  carrier.traceparent = traceparent
  const ctx = propagation.extract(otel.ROOT_CONTEXT, carrier, getter)
  assert.equal(ctx.transaction, undefined)
  assert.equal(ctx.segment, undefined)
  assert.ok(ctx._otelCtx)
  assert.equal(spy.callCount, 0)
})

test('should not propagate traceparent when it does not exist', (t) => {
  const spy = sinon.spy(otel.trace, 'setSpanContext')
  t.after(() => {
    spy.restore()
  })
  const { agent, carrier, getter } = t.nr
  const propagation = new NewRelicTracePropagator(agent)

  const ctx = propagation.extract(otel.ROOT_CONTEXT, carrier, getter)
  assert.equal(ctx.transaction, undefined)
  assert.equal(ctx.segment, undefined)
  assert.ok(ctx._otelCtx)
  assert.equal(spy.callCount, 0)
})

test('should handle multiple tracestate values', async (t) => {
  const plan = tspl(t, { plan: 8 })
  const { agent, carrier, getter } = t.nr
  sinon.stub(otel.trace, 'setSpanContext')
  t.after(() => {
    otel.trace.setSpanContext.restore()
  })

  const propagation = new NewRelicTracePropagator(agent)
  const spanId = '00f067aa0ba902b7'
  const traceId = '00015f9f95352ad550284c27c5d3084c'
  const traceparent = `00-${traceId}-${spanId}-01`
  const tracestate = ['foo-bar', 'baz=bot']
  otel.trace.setSpanContext.callsFake((context, spanContext) => {
    plan.equal(spanContext.isRemote, true)
    plan.equal(spanContext.spanId, spanId)
    plan.equal(spanContext.traceId, traceId)
    plan.equal(spanContext.traceFlags, 1)
    plan.equal(spanContext.traceState.state, tracestate)
    return context
  })

  carrier.traceparent = traceparent
  carrier.tracestate = tracestate
  const ctx = propagation.extract(otel.ROOT_CONTEXT, carrier, getter)
  plan.equal(ctx.transaction, undefined)
  plan.equal(ctx.segment, undefined)
  plan.ok(ctx._otelCtx)
  await plan.completed
})

test('should not set tracestate if it is not a string', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, carrier, getter } = t.nr
  sinon.stub(otel.trace, 'setSpanContext')
  t.after(() => {
    otel.trace.setSpanContext.restore()
  })

  const propagation = new NewRelicTracePropagator(agent)
  const spanId = '00f067aa0ba902b7'
  const traceId = '00015f9f95352ad550284c27c5d3084c'
  const traceparent = `00-${traceId}-${spanId}-01`
  const tracestate = 1
  otel.trace.setSpanContext.callsFake((context, spanContext) => {
    plan.equal(spanContext.traceState.state, undefined)
    return context
  })
  carrier.traceparent = traceparent
  carrier.tracestate = tracestate
  const ctx = propagation.extract(otel.ROOT_CONTEXT, carrier, getter)
  plan.equal(ctx.transaction, undefined)
  plan.equal(ctx.segment, undefined)
  plan.ok(ctx._otelCtx)
  await plan.completed
})

test('should return traceparent/tracestate when fields is called on propagator', (t) => {
  const { agent } = t.nr
  const propagation = new NewRelicTracePropagator(agent)
  const fields = propagation.fields()
  assert.deepEqual(fields, ['traceparent', 'tracestate'])
})
