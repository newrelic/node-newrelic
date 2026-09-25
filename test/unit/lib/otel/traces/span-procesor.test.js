/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const NrTracerProvider = require('#agentlib/otel/traces/nr-tracer-provider.js')
const { SamplingDecision } = require('#agentlib/otel/constants.js')
const helper = require('#testlib/agent_helper.js')
const { otelSynthesis } = require('#agentlib/symbols.js')
const { DESTINATIONS } = require('#agentlib/transaction/index.js')
const NrSpanProcessor = require('#agentlib/otel/traces/span-processor.js')

const {
  createConsumerSpan,
  createFallbackServer,
  createHttpClientSpan,
  createHttpServerSpan,
  createHttpServer1dot23Span,
  createNextjsServerSpan,
  createRpcServerSpan
} = require('../fixtures')

test.beforeEach((ctx) => {
  ctx.nr = {}

  const agent = helper.loadMockedAgent()
  ctx.nr.agent = agent

  ctx.nr.logs = {
    debug: []
  }
  ctx.nr.logger = {
    debug(...args) {
      ctx.nr.logs.debug.push(args)
    }
  }

  const processor = new NrSpanProcessor(agent, { logger: ctx.nr.logger })
  const provider = new NrTracerProvider({
    // Always sample, and never invoke a processor automatically -- these
    // tests exercise the `processor` under test directly via `onStart`/`onEnd`.
    sampler: { shouldSample: () => { return { decision: SamplingDecision.RECORD_AND_SAMPLED } } },
    processor
  })
  const tracer = provider.getTracer('test-tracer', '1.0.0')
  ctx.nr.tracer = tracer
  ctx.nr.processor = processor
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('onStart attaches required entities to internal symbol', (t) => {
  t.plan(4)
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })
    const meta = span[otelSynthesis]
    t.assert.ok(meta)
    t.assert.ok(meta.segment)
    t.assert.ok(meta.transaction)
    t.assert.ok(meta.rule)
    tx.end()
  })
})

test('onEnd sets status code: unset', (t) => {
  t.plan(2)
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })
    const { segment } = span[otelSynthesis]
    span.status.code = 0
    tx.end()

    span.end()

    const attrs = segment.attributes.get(DESTINATIONS.TRANS_SEGMENT)
    t.assert.equal(attrs['status.code'], 'unset')
    t.assert.equal(attrs['status.description'], undefined)
  })
})

test('onEnd sets status code: ok', (t) => {
  t.plan(2)
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })
    const { segment } = span[otelSynthesis]
    span.status.code = 1
    tx.end()

    span.end()

    const attrs = segment.attributes.get(DESTINATIONS.TRANS_SEGMENT)
    t.assert.equal(attrs['status.code'], 'ok')
    t.assert.equal(attrs['status.description'], undefined)
  })
})

test('onEnd sets status code: error', (t) => {
  t.plan(2)
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })
    const { segment } = span[otelSynthesis]
    span.status.code = 2
    span.status.message = 'boom'
    tx.end()

    span.end()

    const attrs = segment.attributes.get(DESTINATIONS.TRANS_SEGMENT)
    t.assert.equal(attrs['status.code'], 'error')
    t.assert.equal(attrs['status.description'], 'boom')
  })
})

test('onEnd adds instrumentation scope attributes', (t) => {
  t.plan(4)
  const { agent, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })
    const { segment } = span[otelSynthesis]
    tx.end()

    span.end()

    const attrs = segment.attributes.get(DESTINATIONS.TRANS_SEGMENT)
    t.assert.equal(attrs['otel.scope.name'], 'test-tracer')
    t.assert.equal(attrs['otel.library.name'], 'test-tracer')
    t.assert.equal(attrs['otel.scope.version'], '1.0.0')
    t.assert.equal(attrs['otel.library.version'], '1.0.0')
  })
})

test('onEnd invokes expected methods', (t) => {
  t.plan(3)
  const { agent, processor, tracer } = t.nr

  let invocations = 0
  processor.updateDuration = interceptor
  processor.handleError = interceptor
  processor.reconcileLinks = interceptor
  processor.reconcileEvents = interceptor
  processor.reconcileAttributes = interceptor
  processor.finalizeTransaction = interceptor

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpServerSpan({ tracer })
    tx.end()

    t.assert.ok(span[otelSynthesis])
    span.end()
    t.assert.equal(invocations, 6)
    t.assert.equal(span[otelSynthesis], undefined)
  })

  function interceptor() {
    invocations += 1
  }
})

test('handleError does nothing if span not an error', (t) => {
  t.plan(1)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })
    span.status.code = 0
    tx.end()

    processor.handleError(span)
    t.assert.equal(agent.errors.eventAggregator.events.length, 0)
  })
})

test('handleError collects exception events', (t) => {
  t.plan(3)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })
    span.events.push({ name: 'skip-me' })
    span.events.push({
      name: 'exception',
      attributes: {
        'exception.message': 'foo',
        'exception.type': 'boom',
        'exception.stacktrace': 'line 1'
      }
    })
    span.events.push({ name: 'whatever' })
    span.events.push({
      name: 'exception',
      attributes: {
        'exception.message': 'bar',
        'exception.type': 'boom',
        'exception.stacktrace': 'line 2'
      }
    })

    const { segment } = span[otelSynthesis]
    span.status.code = 2
    span.status.message = 'boom'

    processor.handleError({ span, segment, transaction: tx })
    tx.end()

    const events = agent.errors.eventAggregator.events.toArray()
    t.assert.equal(events.length, 2)

    const err1 = events[0][0]
    t.assert.match(err1['error.message'], /foo|bar/)
    const err2 = events[1][0]
    t.assert.match(err2['error.message'], /foo|bar/)
  })
})

test('updateDuration touches and converts', (t) => {
  t.plan(2)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })

    const { segment } = span[otelSynthesis]
    segment.touch = () => t.assert.ok('invoked')
    segment.overwriteDurationInMillis = (input) => t.assert.equal(input, 1_000)
    const proxiedSpan = new Proxy(span, {
      get (target, prop) {
        if (prop === 'duration') {
          return [1, 0]
        }
        return target[prop]
      }
    })
    processor.updateDuration(segment, proxiedSpan)

    tx.end()
  })
})

test('reconcileEvents skips work if no events', (t) => {
  t.plan(1)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })

    const { segment } = span[otelSynthesis]
    segment.addTimedEvent = () => t.assert.fail('should not be invoked')
    span.spanContext = () => t.assert.fail('should not be invoked')
    processor.reconcileEvents({ segment, span })
    t.assert.ok('passed')

    tx.end()
  })
})

test('reconcileEvents adds remapped events to the segment', (t) => {
  t.plan(3)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })

    span.events.push({
      name: 'test-event',
      attributes: { test: 'attr' },
      time: [1, 0]
    })

    const { segment } = span[otelSynthesis]
    const addTimedEvent = segment.addTimedEvent
    segment.addTimedEvent = (event) => {
      t.assert.equal(Object.prototype.toString.call(event), '[object TimedEvent]')
      return addTimedEvent.call(segment, event)
    }
    const spanContext = span.spanContext
    span.spanContext = () => {
      t.assert.ok('pass')
      return spanContext.call(span)
    }
    processor.reconcileEvents({ segment, span })
    t.assert.ok(!agent.metrics._metrics.unscoped['Supportability/Nodejs/SpanEvent/Events/Dropped'])

    tx.end()
  })
})

test('reconcileEvents logs `Supportability/Nodejs/SpanEvent/Links/Dropped` when events exceed 100', (t) => {
  t.plan(2)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })

    for (let i = 0; i < 105; i++) {
      span.events.push({
        name: `test-event-${i}`,
        attributes: { test: 'attr' },
        time: [1, 0]
      })
    }

    const { segment } = span[otelSynthesis]
    processor.reconcileEvents({ segment, span })
    t.assert.equal(agent.metrics._metrics.unscoped['Supportability/Nodejs/SpanEvent/Events/Dropped'].callCount, 5)
    t.assert.equal(segment.timedEvents.length, 100)
    tx.end()
  })
})

test('reconcileLinks skips work if no links', (t) => {
  t.plan(1)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })

    const { segment } = span[otelSynthesis]
    segment.addSpanLink = () => t.assert.fail('should not be invoked')
    span.spanContext = () => t.assert.fail('should not be invoked')
    processor.reconcileEvents({ segment, span })
    t.assert.ok('passed')

    tx.end()
  })
})

test('reconcileLinks adds remapped links to the segment', (t) => {
  t.plan(3)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })

    span.links.push({
      attributes: { test: 'attr' },
      context: {
        spanId: 'linked-span',
        traceId: 'linked-trace'
      }
    })

    const { segment } = span[otelSynthesis]
    const addSpanLink = segment.addSpanLink
    segment.addSpanLink = (link) => {
      t.assert.equal(Object.prototype.toString.call(link), '[object SpanLink]')
      return addSpanLink.call(segment, link)
    }
    const spanContext = span.spanContext
    span.spanContext = () => {
      t.assert.ok('pass')
      return spanContext.call(span)
    }
    processor.reconcileLinks({ segment, otelSpan: span })
    t.assert.ok(!agent.metrics._metrics.unscoped['Supportability/Nodejs/SpanEvent/Links/Dropped'])

    tx.end()
  })
})

test('reconcileLinks logs `Supportability/Nodejs/SpanEvent/Links/Dropped` when links exceed 100', (t) => {
  t.plan(2)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })

    for (let i = 0; i < 105; i++) {
      span.links.push({
        attributes: { test: `attr-${i}` },
        context: {
          spanId: 'linked-span',
          traceId: 'linked-trace'
        }
      })
    }

    const { segment } = span[otelSynthesis]
    processor.reconcileLinks({ segment, otelSpan: span })
    t.assert.equal(agent.metrics._metrics.unscoped['Supportability/Nodejs/SpanEvent/Links/Dropped'].callCount, 5)
    t.assert.equal(segment.spanLinks.length, 100)
    tx.end()
  })
})

test('reconcileAttributes handles rules with regular expressions', (t) => {
  t.plan(3)
  const { agent, processor, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })
    processor.onStart(span)

    const { segment, transaction, rule } = span[otelSynthesis]
    let attrs = segment.attributes.get(DESTINATIONS.SEGMENT_SCOPE)
    t.assert.equal(Object.keys(attrs).length, 0)
    processor.reconcileAttributes({ segment, span, transaction, rule })
    attrs = segment.attributes.get(DESTINATIONS.SEGMENT_SCOPE)
    t.assert.equal(Object.keys(attrs).length, 7)
    t.assert.equal(
      attrs['request.parameters.q'],
      'test',
      'regex maps incoming attribute to segment attribute'
    )

    tx.end()
  })
})

test('reconcileAttributes logs for high security attributes', (t) => {
  t.plan(5)
  const { agent, processor, tracer } = t.nr
  agent.config.high_security = true

  helper.runInTransaction(agent, (tx) => {
    const span = createConsumerSpan({ tracer })
    processor.onStart(span)

    const { segment, transaction, rule } = span[otelSynthesis]
    let attrs = segment.attributes.get(DESTINATIONS.SEGMENT_SCOPE)
    t.assert.equal(Object.keys(attrs).length, 0)
    processor.reconcileAttributes({ segment, span, transaction, rule })
    attrs = segment.attributes.get(DESTINATIONS.SEGMENT_SCOPE)
    t.assert.equal(Object.keys(attrs).length, 2)

    const expected = [
      ['messaging.destination.name', 'trace'],
      ['messaging.destination.name', 'segment'],
      ['messaging.rabbitmq.destination.routing_key', 'trace']
    ]
    for (let i = 0; i < t.nr.logs.debug.length; i += 1) {
      t.assert.equal(
        t.nr.logs.debug[i][0],
        `Not adding attribute ${expected[i][0]} to ${expected[i][1]} because ` +
        'it gets dropped as part of high_security mode.',
        'logged correct message'
      )
    }

    tx.end()
  })
})

test('finalizeTransaction handles tx with prefix transforms', (t) => {
  // This test must not run in an existing transaction. If it were, the
  // create segment function will remove the `txTransformation` information.
  t.plan(5)
  const { processor, tracer } = t.nr

  const span = createRpcServerSpan({ tracer })
  processor.onStart(span)

  const { segment, transaction, rule } = span[otelSynthesis]
  t.assert.equal(transaction.isActive(), true)

  const nameState = transaction.nameState
  t.assert.equal(nameState.prefix, null)

  processor.finalizeTransaction({ rule, segment, span, transaction })
  t.assert.equal(transaction.isActive(), false)
  t.assert.equal(nameState.prefix, 'grpc')
  t.assert.deepStrictEqual(nameState.pathStack, [{
    params: null,
    path: 'TestService/findUser'
  }])
})

test('finalizeTransaction handles tx with verb and path transforms', (t) => {
  // This test must not run in an existing transaction. If it were, the
  // create segment function will remove the `txTransformation` information.
  t.plan(6)
  const { processor, tracer } = t.nr

  const span = createHttpServerSpan({ tracer })
  processor.onStart(span)
  const finalizeWebTransaction = processor.finalizeTransaction
  processor.finalizeTransaction = (params) => {
    t.assert.ok('pass')
    finalizeWebTransaction.call(processor, params)
  }

  const { segment, transaction, rule } = span[otelSynthesis]
  t.assert.equal(transaction.isActive(), true)

  const nameState = transaction.nameState
  t.assert.equal(nameState.verb, null)

  processor.finalizeTransaction({ rule, segment, span, transaction })
  t.assert.equal(transaction.isActive(), false)
  t.assert.equal(nameState.verb, 'PUT')
  t.assert.deepStrictEqual(nameState.pathStack, [{
    params: null,
    path: '/user/:id'
  }])
})

test('finalizeTransaction handles tx with templateValue transform', (t) => {
  // This test must not run in an existing transaction. If it were, the
  // create segment function will remove the `txTransformation` information.
  t.plan(4)
  const { agent, processor, tracer } = t.nr
  agent.config.high_security = true

  const span = createConsumerSpan({ tracer })
  processor.onStart(span)

  const { segment, transaction, rule } = span[otelSynthesis]
  t.assert.equal(transaction.isActive(), true)
  t.assert.equal(segment.name, 'test-span')

  processor.finalizeTransaction({ rule, segment, span, transaction })
  t.assert.equal(transaction.isActive(), false)
  t.assert.equal(segment.name, 'OtherTransaction/Message/messaging-lib/send/Named/test-topic')
})

test('finalizeTransaction handles tx with static name value transform', (t) => {
  // This test must not run in an existing transaction. If it were, the
  // create segment function will remove the `txTransformation` information.
  t.plan(4)
  const { agent, processor, tracer } = t.nr
  agent.config.high_security = true

  const span = createFallbackServer({ tracer })

  const { segment, transaction, rule } = span[otelSynthesis]
  t.assert.equal(transaction.isActive(), true)
  t.assert.equal(segment.name, 'test-span')

  processor.finalizeTransaction({ rule, segment, span, transaction })
  t.assert.equal(transaction.isActive(), false)
  t.assert.equal(segment.name, 'WebTransaction/WebFrameworkUri//unknown')
})

test('finalizeWebTransaction handles url.template transforms', (t) => {
  // This test must not run in an existing transaction. If it were, the
  // create segment function will remove the `txTransformation` information.
  t.plan(5)
  const { processor, tracer } = t.nr

  const span = createHttpServer1dot23Span({ tracer })
  processor.onStart(span)
  span.attributes['url.scheme'] = 'http'
  span.attributes['server.address'] = 'example.com'
  span.attributes['server.port'] = '80'
  span.attributes['url.path'] = '/foo'
  span.attributes['url.query'] = 'a=b'

  const { transaction, rule } = span[otelSynthesis]
  const nameState = transaction.nameState
  t.assert.equal(nameState.prefix, null)

  const finalizeNameFromWeb = transaction.finalizeNameFromWeb
  transaction.finalizeNameFromWeb = (code) => {
    t.assert.equal(code, 418)
    finalizeNameFromWeb.call(transaction, code)
  }
  transaction.statusCode = 418

  processor.finalizeWebTransaction({
    span,
    transaction,
    txTransformation: rule.txTransformation
  })
  t.assert.equal(transaction.url, '/foo')
  t.assert.equal(t.nr.logs.debug.length, 0)
  t.assert.deepStrictEqual(nameState.pathStack, [{
    params: null,
    path: '/foo'
  }])
})

test('finalizeWebTransaction handles url.key transforms', (t) => {
  // This test must not run in an existing transaction. If it were, the
  // create segment function will remove the `txTransformation` information.
  t.plan(4)
  const { processor, tracer } = t.nr

  const span = createHttpServerSpan({ tracer })
  processor.onStart(span)
  span.attributes['http.url'] = 'http://example.com/foo?a=b'

  const { transaction, rule } = span[otelSynthesis]
  const nameState = transaction.nameState
  t.assert.equal(nameState.prefix, null)

  processor.finalizeWebTransaction({
    span,
    transaction,
    txTransformation: rule.txTransformation
  })
  t.assert.equal(transaction.url, '/foo')
  t.assert.equal(t.nr.logs.debug.length, 0)
  t.assert.deepStrictEqual(nameState.pathStack, [{
    params: null,
    path: '/foo'
  }])
})

test('finalizeWebTransaction logs if url is invalid', (t) => {
  // This test must not run in an existing transaction. If it were, the
  // create segment function will remove the `txTransformation` information.
  t.plan(2)
  const { processor, tracer } = t.nr

  const span = createHttpServerSpan({ tracer })
  processor.onStart(span)

  const { transaction, rule } = span[otelSynthesis]
  processor.finalizeWebTransaction({
    span,
    transaction,
    txTransformation: rule.txTransformation
  })
  t.assert.equal(t.nr.logs.debug.length, 1)
  t.assert.deepStrictEqual(t.nr.logs.debug[0], [
    'Could not parse URL from span for transaction URL: %s, err: %s',
    '/user/1',
    'Invalid URL'
  ])
})

test('finalizeTransaction handles next.js server spans', (t) => {
  t.plan(3)
  const { processor, tracer } = t.nr

  const span = createNextjsServerSpan({ tracer })
  processor.onStart(span)

  const { transaction, rule } = span[otelSynthesis]
  processor.finalizeTransaction({
    span,
    transaction,
    rule
  })
  t.assert.equal(transaction.url, '/user/1')
  t.assert.equal(t.nr.logs.debug.length, 0)
  t.assert.equal(transaction.name, 'WebTransaction/WebFrameworkUri//PUT/user/:id')
})
