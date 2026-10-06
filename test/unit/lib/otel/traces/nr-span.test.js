/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert')
const { NrSpan } = require('#agentlib/otel/traces/nr-span.js')
const { ATTR_VALUE_LENGTH_LIMIT } = require('#agentlib/otel/constants.js')
const { makeProcessor } = require('./helpers')

const OVER_LIMIT = 'x'.repeat(ATTR_VALUE_LENGTH_LIMIT + 1)
const AT_LIMIT = 'x'.repeat(ATTR_VALUE_LENGTH_LIMIT)

function makeSpanContext() {
  return { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: 1 }
}

function makeSpan(overrides = {}) {
  return new NrSpan({
    name: 'test-span',
    kind: 0,
    spanContext: makeSpanContext(),
    instrumentationScope: { name: 'test', version: '1.0' },
    processor: makeProcessor(),
    ...overrides
  })
}

describe('constructor', () => {
  test('attributes are truncated', () => {
    const span = makeSpan({ attributes: { key: OVER_LIMIT } })
    assert.equal(span.attributes['key'].length, ATTR_VALUE_LENGTH_LIMIT)
  })

  test('links are truncated', () => {
    const link = { context: makeSpanContext(), attributes: { key: OVER_LIMIT } }
    const span = makeSpan({ links: [link] })
    assert.equal(span.links[0].attributes.key.length, ATTR_VALUE_LENGTH_LIMIT)
    assert.equal(link.attributes.key.length, OVER_LIMIT.length)
  })

  test('defaults instrumentationScope when not provided', () => {
    const span = new NrSpan({
      name: 'test-span',
      kind: 0,
      spanContext: makeSpanContext(),
      processor: makeProcessor()
    })
    assert.deepEqual(span.instrumentationScope, { name: '', version: undefined })
  })
})

test('spanContext returns the stored span context', () => {
  const ctx = makeSpanContext()
  const span = makeSpan({ spanContext: ctx })
  assert.strictEqual(span.spanContext(), ctx)
})

describe('setAttribute', () => {
  test('stores the value', () => {
    const span = makeSpan()
    span.setAttribute('key', 'value')
    assert.equal(span.attributes['key'], 'value')
  })

  test('truncates string values longer than ATTR_VALUE_LENGTH_LIMIT', () => {
    const span = makeSpan()
    span.setAttribute('key', OVER_LIMIT)
    assert.equal(span.attributes['key'].length, ATTR_VALUE_LENGTH_LIMIT)
  })

  test('does not truncate strings at exactly the limit', () => {
    const span = makeSpan()
    span.setAttribute('key', AT_LIMIT)
    assert.equal(span.attributes['key'].length, ATTR_VALUE_LENGTH_LIMIT)
  })

  test('does not truncate non-string values', () => {
    const span = makeSpan()
    span.setAttribute('num', 12345)
    span.setAttribute('bool', true)
    assert.equal(span.attributes['num'], 12345)
    assert.equal(span.attributes['bool'], true)
  })

  test('truncates all over-limit string values', () => {
    const span = makeSpan()
    span.setAttributes({ short: 'ok', long: OVER_LIMIT })
    assert.equal(span.attributes['short'], 'ok')
    assert.equal(span.attributes['long'].length, ATTR_VALUE_LENGTH_LIMIT)
  })

  test('ignores a null or undefined value', () => {
    const span = makeSpan()
    span.setAttribute('nil', null)
    span.setAttribute('undef', undefined)
    assert.equal('nil' in span.attributes, false)
    assert.equal('undef' in span.attributes, false)
  })

  test('skips an empty key', () => {
    const span = makeSpan()
    span.setAttribute('', 'value')
    assert.deepEqual(span.attributes, {})
  })

  test('skips an invalid attribute value', () => {
    const span = makeSpan()
    span.setAttribute('bad', { nested: true })
    assert.equal('bad' in span.attributes, false)
  })

  test('skips a heterogeneous array value', () => {
    const span = makeSpan()
    span.setAttribute('bad', ['a', 1])
    assert.equal('bad' in span.attributes, false)
  })

  test('accepts a homogeneous array value', () => {
    const span = makeSpan()
    span.setAttribute('good', ['a', 'b'])
    assert.deepEqual(span.attributes['good'], ['a', 'b'])
  })

  test('accepts an array containing null or undefined elements', () => {
    const span = makeSpan()
    span.setAttribute('good', ['a', null, undefined, 'b'])
    assert.deepEqual(span.attributes['good'], ['a', null, undefined, 'b'])
  })

  test('does not store the value once the span has ended', () => {
    const span = makeSpan()
    span.end()
    span.setAttribute('key', 'value')
    assert.equal('key' in span.attributes, false)
  })
})

describe('addEvent', () => {
  test('stores event with name', () => {
    const span = makeSpan()
    span.addEvent('my-event')
    assert.equal(span.events.length, 1)
    assert.equal(span.events[0].name, 'my-event')
  })

  test('stores event attributes', () => {
    const span = makeSpan()
    span.addEvent('ev', { foo: 'bar' })
    assert.equal(span.events[0].attributes.foo, 'bar')
  })

  test('truncates over-limit string event attributes', () => {
    const span = makeSpan()
    span.addEvent('ev', { key: OVER_LIMIT })
    assert.equal(span.events[0].attributes.key.length, ATTR_VALUE_LENGTH_LIMIT)
  })

  test('with a time argument does not treat it as attributes', () => {
    const span = makeSpan()
    const time = [1234, 0]
    span.addEvent('ev', time)
    assert.deepEqual(span.events[0].attributes, {})
  })

  test('uses the timeStamp argument when attributes are also given', () => {
    const span = makeSpan()
    const time = [1234, 0]
    span.addEvent('ev', { foo: 'bar' }, time)
    assert.deepEqual(span.events[0].time, time)
  })

  test('does not add an event once the span has ended', () => {
    const span = makeSpan()
    span.end()
    span.addEvent('ev')
    assert.equal(span.events.length, 0)
  })
})

describe('addLink/addLinks', () => {
  test('stores the link', () => {
    const span = makeSpan()
    const link = { context: makeSpanContext() }
    span.addLink(link)
    assert.equal(span.links.length, 1)
  })

  test('truncates over-limit string link attributes', () => {
    const span = makeSpan()
    span.addLink({ context: makeSpanContext(), attributes: { key: OVER_LIMIT } })
    assert.equal(span.links[0].attributes.key.length, ATTR_VALUE_LENGTH_LIMIT)
  })

  test('does not mutate the original link object', () => {
    const span = makeSpan()
    const link = { context: makeSpanContext(), attributes: { key: OVER_LIMIT } }
    span.addLink(link)
    assert.equal(link.attributes.key.length, OVER_LIMIT.length)
  })

  test('stores all links', () => {
    const span = makeSpan()
    span.addLinks([
      { context: makeSpanContext() },
      { context: makeSpanContext() }
    ])
    assert.equal(span.links.length, 2)
  })

  test('does not add a link once the span has ended', () => {
    const span = makeSpan()
    span.end()
    span.addLink({ context: makeSpanContext() })
    assert.equal(span.links.length, 0)
  })
})

describe('setStatus', () => {
  test('updates status code and message', () => {
    const span = makeSpan()
    span.setStatus({ code: 2, message: 'oops' })
    assert.deepEqual(span.status, { code: 2, message: 'oops' })
  })

  test('ignores an UNSET status code', () => {
    const span = makeSpan()
    span.setStatus({ code: 2, message: 'oops' })
    span.setStatus({ code: 0 })
    assert.deepEqual(span.status, { code: 2, message: 'oops' })
  })

  test('is sticky once set to OK', () => {
    const span = makeSpan()
    span.setStatus({ code: 1 })
    span.setStatus({ code: 2, message: 'oops' })
    assert.deepEqual(span.status, { code: 1 })
  })

  test('drops a non-string message', () => {
    const span = makeSpan()
    span.setStatus({ code: 2, message: { not: 'a string' } })
    assert.deepEqual(span.status, { code: 2 })
  })

  test('does not update status once the span has ended', () => {
    const span = makeSpan()
    span.end()
    span.setStatus({ code: 2, message: 'oops' })
    assert.deepEqual(span.status, { code: 0 })
  })
})

describe('updateName', () => {
  test('updates the span name', () => {
    const span = makeSpan()
    span.updateName('new-name')
    assert.equal(span.name, 'new-name')
  })

  test('does not update the name once the span has ended', () => {
    const span = makeSpan()
    span.end()
    span.updateName('new-name')
    assert.equal(span.name, 'test-span')
  })
})

describe('isRecording', () => {
  test('returns true before end', () => {
    const span = makeSpan()
    assert.equal(span.isRecording(), true)
  })

  test('returns false after end', () => {
    const span = makeSpan()
    span.end()
    assert.equal(span.isRecording(), false)
  })
})

describe('ended', () => {
  test('returns false before end', () => {
    const span = makeSpan()
    assert.equal(span.ended, false)
  })

  test('returns true after end', () => {
    const span = makeSpan()
    span.end()
    assert.equal(span.ended, true)
  })
})

describe('end', () => {
  test('calls processor.onEnd', () => {
    const processor = makeProcessor()
    const span = makeSpan({ processor })
    span.end()
    assert.equal(processor.calls.onEnd.length, 1)
    assert.strictEqual(processor.calls.onEnd[0], span)
  })

  test('is idempotent — processor.onEnd called exactly once', () => {
    const processor = makeProcessor()
    const span = makeSpan({ processor })
    span.end()
    span.end()
    assert.equal(processor.calls.onEnd.length, 1)
  })

  test('computes a non-negative duration', () => {
    const span = makeSpan()
    span.end()
    const [seconds, nanos] = span.duration
    assert.ok(seconds >= 0)
    assert.ok(nanos >= 0)
  })

  test('clamps duration to zero when endTime is before startTime', () => {
    const span = makeSpan({ startTime: [1000, 0] })
    span.end([500, 0])
    assert.deepEqual(span.duration, [0, 0])
  })
})

describe('recordException', () => {
  test('with a string adds an exception event', () => {
    const span = makeSpan()
    span.recordException('something broke')
    assert.equal(span.events.length, 1)
    assert.equal(span.events[0].name, 'exception')
    assert.equal(span.events[0].attributes['exception.message'], 'something broke')
  })

  test('with an Error adds type, message, and stacktrace', () => {
    const span = makeSpan()
    const err = new Error('bad')
    span.recordException(err)
    const attrs = span.events[0].attributes
    assert.equal(attrs['exception.type'], 'Error')
    assert.equal(attrs['exception.message'], 'bad')
    assert.ok(attrs['exception.stacktrace'].includes('Error: bad'))
  })

  test('with an exception that has a code uses it as the type', () => {
    const span = makeSpan()
    const err = new Error('no such file')
    err.code = 'ENOENT'
    span.recordException(err)
    const attrs = span.events[0].attributes
    assert.equal(attrs['exception.type'], 'ENOENT')
    assert.equal(attrs['exception.message'], 'no such file')
  })

  test('with no useful info does not add an event', () => {
    const span = makeSpan()
    span.recordException({})
    assert.equal(span.events.length, 0)
  })
})
