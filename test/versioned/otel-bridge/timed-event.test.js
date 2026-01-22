/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const helper = require('../../lib/agent_helper')
const { createServer } = require('../../lib/undici-mock-server')
const assert = require('node:assert')
const { PARTIAL_TYPES } = require('../../../lib/transaction/index')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    instrumentation: {
      undici: {
        enabled: false
      },
      http: {
        enabled: false
      }
    },
    opentelemetry: {
      enabled: true,
      traces: { enabled: true }
    }
  })
  agent.config.entity_guid = 'guid-123456'
  agent.config.license_key = 'license-123456'

  const { registerInstrumentations } = require('@opentelemetry/instrumentation')
  const { UndiciInstrumentation } = require('@opentelemetry/instrumentation-undici')

  const requestHook = (span, request) => {
    // Add a custom event to the OTEL span
    span.addEvent('custom.request.event', {
      'event.type': 'custom',
      'request.url': request.origin + request.path,
      'custom.attribute': 'test-value'
    })
  }

  const responseHook = (span, response) => {
    // Add a custom event to the OTEL span
    span.addEvent('custom.response.event', {
      'event.type': 'custom-2',
      'response.status_code': response.response.statusCode,
      'custom.attribute': 'test-value-2'
    })
  }

  const { server, HOST, REQUEST_URL } = createServer()

  ctx.nr = {
    agent,
    server,
    HOST,
    REQUEST_URL,
    requestHook,
    responseHook,
    registerInstrumentations,
    UndiciInstrumentation
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.close()
})

test('should properly attach span event data for one span event', async (t) => {
  const { agent, REQUEST_URL, requestHook, registerInstrumentations, UndiciInstrumentation } = t.nr

  registerInstrumentations([
    new UndiciInstrumentation({
      requestHook
    })
  ])

  await helper.runInTransaction(agent, async (tx) => {
    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(status, 200)
    tx.end()
    const segment = tx.trace.root
    const segmentChildren = tx.trace.getChildren(segment.id)
    const foundSegment = segmentChildren.find((c) => c.name === 'External/localhost/post')
    if (foundSegment) {
      const httpSpanEvent = agent.spanEventAggregator.getEvents().find(
        (s) => s.intrinsics.name === 'External/localhost/post'
      )

      assert.equal(httpSpanEvent.timedEvents.length, 1)

      const event = httpSpanEvent.timedEvents[0]
      assert.equal(event.agentAttributes.attributes['event.type'].value, 'custom')
      assert.equal(event.agentAttributes.attributes['request.url'].value, `${REQUEST_URL}/post`)
      assert.equal(event.agentAttributes.attributes['custom.attribute'].value, 'test-value')

      assert.equal(event.intrinsics.type, 'SpanEvent')
      assert.equal(event.intrinsics['span.id'], httpSpanEvent.intrinsics.guid)
      assert.equal(event.intrinsics['trace.id'], tx.traceId)
      // It's best we check the window between the two timestamps since we can't
      // easily set the timestamp on the event.
      assert.equal(
        httpSpanEvent.intrinsics.timestamp - event.intrinsics.timestamp <= 10,
        true,
        'timestamp should be within expected window'
      )
    }
  })
})

test('should properly attach span event data for two span events', async (t) => {
  const { agent, REQUEST_URL, requestHook, responseHook, registerInstrumentations, UndiciInstrumentation } = t.nr

  registerInstrumentations([
    new UndiciInstrumentation({
      requestHook,
      responseHook
    })
  ])

  await helper.runInTransaction(agent, async (tx) => {
    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(status, 200)
    tx.end()
    const segment = tx.trace.root
    const segmentChildren = tx.trace.getChildren(segment.id)
    const foundSegment = segmentChildren.find((c) => c.name === 'External/localhost/post')
    if (foundSegment) {
      const httpSpanEvent = agent.spanEventAggregator.getEvents().find(
        (s) => s.intrinsics.name === 'External/localhost/post'
      )

      assert.equal(httpSpanEvent.timedEvents.length, 2)

      const eventOne = httpSpanEvent.timedEvents[0]
      assert.equal(eventOne.agentAttributes.attributes['event.type'].value, 'custom')
      assert.equal(eventOne.agentAttributes.attributes['request.url'].value, `${REQUEST_URL}/post`)
      assert.equal(eventOne.agentAttributes.attributes['custom.attribute'].value, 'test-value')

      assert.equal(eventOne.intrinsics.type, 'SpanEvent')
      assert.equal(eventOne.intrinsics['span.id'], httpSpanEvent.intrinsics.guid)
      assert.equal(eventOne.intrinsics['trace.id'], tx.traceId)
      // It's best we check the window between the two timestamps since we can't
      // easily set the timestamp on the event.
      assert.equal(
        httpSpanEvent.intrinsics.timestamp - eventOne.intrinsics.timestamp <= 10,
        true,
        'timestamp should be within expected window'
      )

      const eventTwo = httpSpanEvent.timedEvents[1]
      assert.equal(eventTwo.agentAttributes.attributes['event.type'].value, 'custom-2')
      assert.equal(eventTwo.agentAttributes.attributes['response.status_code'].value, 200)
      assert.equal(eventTwo.agentAttributes.attributes['custom.attribute'].value, 'test-value-2')

      assert.equal(eventTwo.intrinsics.type, 'SpanEvent')
      assert.equal(eventTwo.intrinsics['span.id'], httpSpanEvent.intrinsics.guid)
      assert.equal(eventTwo.intrinsics['trace.id'], tx.traceId)
      // It's best we check the window between the two timestamps since we can't
      // easily set the timestamp on the event.
      assert.equal(
        httpSpanEvent.intrinsics.timestamp - eventTwo.intrinsics.timestamp <= 10,
        true,
        'timestamp should be within expected window'
      )
    }
  })
})

test('should drop all span events if partial granularity is enabled with reduced type', async (t) => {
  const { agent, REQUEST_URL, requestHook, responseHook, registerInstrumentations, UndiciInstrumentation } = t.nr
  agent.config.distributed_tracing.sampler.partial_granularity.enabled = true
  agent.config.distributed_tracing.sampler.partial_granularity.type = 'reduced'

  registerInstrumentations([
    new UndiciInstrumentation({
      requestHook,
      responseHook
    })
  ])

  await helper.runInTransaction(agent, async (tx) => {
    // Force tx to be partial
    tx.partialTrace = true
    tx.partialType = PARTIAL_TYPES.REDUCED
    tx.createPartialTrace()

    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(status, 200)
    tx.end()
    const segment = tx.trace.root
    const segmentChildren = tx.trace.getChildren(segment.id)
    const foundSegment = segmentChildren.find((c) => c.name === 'External/localhost/post')
    assert.ok(foundSegment, 'should still create segment')
    assert.equal(foundSegment.timedEvents.length, 2, 'segment should have 2 timed events')
    const spanEvents = agent.spanEventAggregator.getEvents()
    assert.equal(spanEvents.length, 0, 'should not have span events')
  })
})

test('should drop all span events if partial granularity is enabled with compact type', async (t) => {
  const { agent, REQUEST_URL, requestHook, responseHook, registerInstrumentations, UndiciInstrumentation } = t.nr
  agent.config.distributed_tracing.sampler.partial_granularity.enabled = true
  agent.config.distributed_tracing.sampler.partial_granularity.type = 'compact'

  registerInstrumentations([
    new UndiciInstrumentation({
      requestHook,
      responseHook
    })
  ])

  await helper.runInTransaction(agent, async (tx) => {
    // Force tx to be partial
    tx.partialTrace = true
    tx.partialType = PARTIAL_TYPES.COMPACT
    tx.createPartialTrace()

    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(status, 200)
    tx.end()
    const segment = tx.trace.root
    const segmentChildren = tx.trace.getChildren(segment.id)
    const foundSegment = segmentChildren.find((c) => c.name === 'External/localhost/post')
    assert.ok(foundSegment, 'should still create segment')
    assert.equal(foundSegment.timedEvents.length, 2, 'segment should have 2 timed events')
    const spanEvents = agent.spanEventAggregator.getEvents()
    assert.equal(spanEvents.length, 0, 'should not have span events')
  })
})

test('should drop all span events if partial granularity is enabled with essential type', async (t) => {
  const { agent, REQUEST_URL, requestHook, responseHook, registerInstrumentations, UndiciInstrumentation } = t.nr
  agent.config.distributed_tracing.sampler.partial_granularity.enabled = true
  agent.config.distributed_tracing.sampler.partial_granularity.type = 'essential'

  registerInstrumentations([
    new UndiciInstrumentation({
      requestHook,
      responseHook
    })
  ])

  await helper.runInTransaction(agent, async (tx) => {
    // Force tx to be partial
    tx.partialTrace = true
    tx.partialType = PARTIAL_TYPES.ESSENTIAL
    tx.createPartialTrace()

    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(status, 200)
    tx.end()
    const segment = tx.trace.root
    const segmentChildren = tx.trace.getChildren(segment.id)
    const foundSegment = segmentChildren.find((c) => c.name === 'External/localhost/post')
    assert.ok(foundSegment, 'should still create segment')
    assert.equal(foundSegment.timedEvents.length, 2, 'segment should have 2 timed events')
    const spanEvents = agent.spanEventAggregator.getEvents()
    assert.equal(spanEvents.length, 0, 'should not have span events')
  })
})
