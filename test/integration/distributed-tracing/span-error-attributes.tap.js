/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const tspl = require('@matteo.collina/tspl')

const match = require('../../lib/custom-assertions/match')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')

test('core', async (t) => {
  const plan = tspl(t, { plan: 6 })

  const agent = helper.instrumentMockedAgent({
    distributed_tracing: { enabled: true }
  })
  const api = new API(agent)

  const spanIds = []
  const numErrors = 3

  agent.on('transactionFinished', () => {
    const errorEvents = agent.errors.eventAggregator.getEvents()
    const errorEventSpanIds = errorEvents.map((e) => e[2].spanId)

    plan.deepStrictEqual(
      new Set(spanIds),
      new Set(errorEventSpanIds),
      'Every TransactionError event should have a unique span ID'
    )

    plan.equal(errorEvents.length, numErrors, 'Every error was reported')

    const spanEvents = agent.spanEventAggregator.getEvents()

    spanEvents.forEach((s) => {
      const attrs = s.attributes
      match(attrs['error.message'], /test\d/, { assert: plan })

      match(attrs['error.class'], 'Error', { assert: plan })
    })

    plan.equal(spanEvents.length, numErrors, 'Every span was reported')
  })

  helper.runInTransaction(agent, (tx) => {
    for (let i = 0; i < numErrors; i++) {
      api.startSegment(`segment${i}`, true, () => {
        const segment = api.shim.getSegment()
        spanIds.push(segment.id)
        api.noticeError(new Error(`test${i}`))
      })
    }

    tx.end()
  })

  t.after(() => helper.unloadAgent(agent))

  await plan.completed
})

test('should not add error attributes to spans when errors disabled', (t, end) => {
  const agent = helper.instrumentMockedAgent({
    distributed_tracing: {
      enabled: true
    },
    error_collector: {
      enabled: false
    }
  })

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const api = new API(agent)

  let spanId = null

  agent.on('transactionFinished', () => {
    const spanEvent = agent.spanEventAggregator.getEvents()[0]

    assert.equal(spanEvent.intrinsics.guid, spanId)

    const hasAttribute = Object.hasOwnProperty.bind(spanEvent.attributes)
    assert.equal(hasAttribute('error.message'), false)

    end()
  })

  helper.runInTransaction(agent, (tx) => {
    api.startSegment('segment', true, () => {
      const segment = api.shim.getSegment()
      spanId = segment.id
      api.noticeError(new Error('test'))
    })

    tx.end()
  })
})

test("Span error attributes aren't added with LASP/HSM", (t, end) => {
  const agent = helper.instrumentMockedAgent({
    distributed_tracing: { enabled: true },
    high_security: true
  })
  const api = new API(agent)

  let spanId

  agent.on('transactionFinished', () => {
    const spanEvent = agent.spanEventAggregator.getEvents()[0]
    const attrs = spanEvent.attributes
    assert.ok(
      spanEvent.intrinsics.guid === spanId && !attrs['error.message'],
      'There should be no error message on the span'
    )
    end()
  })

  helper.runInTransaction(agent, (tx) => {
    api.startSegment('segment', true, () => {
      const segment = api.shim.getSegment()
      spanId = segment.id
      api.noticeError(new Error('test'))
    })

    tx.end()
  })

  t.after(() => helper.unloadAgent(agent))
})

test("Span error attributes aren't added with ignored classes errors", (t, end) => {
  const agent = helper.instrumentMockedAgent({
    distributed_tracing: { enabled: true },
    error_collector: { ignore_classes: ['CustomError'] }
  })
  const api = new API(agent)

  let ignoredSpanId
  let spanId

  agent.on('transactionFinished', () => {
    const errorEvents = agent.errors.eventAggregator.getEvents()
    const spanEvents = agent.spanEventAggregator.getEvents()
    const ignoredSpanEvent = spanEvents.filter((s) => s.intrinsics.guid === ignoredSpanId)[0]
    const spanEvent = spanEvents.filter((s) => s.intrinsics.guid === spanId)[0]

    assert.ok(
      errorEvents.length === 1 && errorEvents[0][2].spanId === spanId,
      'There should only be the non-ignored error reported'
    )

    assert.ok(
      spanEvent.attributes['error.message'] === 'not ignored',
      'The non-ignored error should be reported'
    )

    assert.equal(
      ignoredSpanEvent.attributes['error.message'],
      undefined,
      'The ignored error should not be reported'
    )

    end()
  })

  helper.runInTransaction(agent, (tx) => {
    class CustomError extends Error {
      constructor() {
        super(...arguments)
        this.name = 'CustomError'
      }
    }

    api.startSegment('segment1', true, () => {
      const segment = api.shim.getSegment()
      ignoredSpanId = segment.id
      agent.errors.add(tx, new CustomError('ignored'))
    })

    api.startSegment('segment2', true, () => {
      const segment = api.shim.getSegment()
      spanId = segment.id
      agent.errors.add(tx, new Error('not ignored'))
    })

    tx.end()
  })

  t.after(() => helper.unloadAgent(agent))
})

test("Span error attributes aren't added with ignored status errors", (t, end) => {
  const agent = helper.instrumentMockedAgent({
    distributed_tracing: { enabled: true },
    error_collector: { ignore_status_codes: [404, 422] }
  })
  const api = new API(agent)

  let ignoredSpanId = null

  agent.on('transactionFinished', () => {
    const errorEvents = agent.errors.eventAggregator.getEvents()
    const spanEvents = agent.spanEventAggregator.getEvents()
    const ignoredSpanEvent = spanEvents.filter((s) => s.intrinsics.guid === ignoredSpanId)[0]

    assert.equal(
      errorEvents.length,
      0,
      'There should not be any errors reported because of status code'
    )

    assert.equal(
      ignoredSpanEvent.attributes['error.message'],
      undefined,
      'The ignored error should not be added to span.'
    )

    end()
  })

  helper.runInTransaction(agent, (tx) => {
    class CustomError extends Error {
      constructor() {
        super(...arguments)
        this.name = 'CustomError'
      }
    }

    api.startSegment('segment1', true, () => {
      const segment = api.shim.getSegment()
      ignoredSpanId = segment.id
      agent.errors.add(tx, new CustomError('ignored'))
    })

    tx.statusCode = 422
    tx.end()
  })

  t.after(() => helper.unloadAgent(agent))
})

test('should propagate expected error attribute to span', (t, end) => {
  const agent = helper.instrumentMockedAgent({
    distributed_tracing: {
      enabled: true
    },
    error_collector: {
      expected_classes: ['CustomError']
    }
  })

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const api = new API(agent)

  let expectedSpanId
  let notExpectedSpanId

  agent.on('transactionFinished', () => {
    const errorEvents = agent.errors.eventAggregator.getEvents()
    const spanEvents = agent.spanEventAggregator.getEvents()
    const expectedSpanEvent = spanEvents.filter((s) => s.intrinsics.guid === expectedSpanId)[0]
    const spanEvent = spanEvents.filter((s) => s.intrinsics.guid === notExpectedSpanId)[0]

    assert.equal(errorEvents.length, 2)

    assert.equal(expectedSpanEvent.attributes['error.expected'], true)

    const hasAttribute = Object.hasOwnProperty.bind(spanEvent.attributes)
    assert.equal(hasAttribute('error.expected'), false)

    end()
  })

  helper.runInTransaction(agent, (tx) => {
    class CustomError extends Error {
      constructor() {
        super(...arguments)
        this.name = 'CustomError'
      }
    }

    api.startSegment('segment1', true, () => {
      const segment = api.shim.getSegment()
      expectedSpanId = segment.id
      agent.errors.add(tx, new CustomError('expected'))
    })

    api.startSegment('segment2', true, () => {
      const segment = api.shim.getSegment()
      notExpectedSpanId = segment.id
      agent.errors.add(tx, new Error('not expected'))
    })

    tx.end()
  })
})
