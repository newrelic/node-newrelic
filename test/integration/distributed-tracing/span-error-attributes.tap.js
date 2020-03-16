'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')

tap.test('span error attributes', (t) => {
  t.test('core', (t) => {
    const config = {
      distributed_tracing: { enabled: true },
      feature_flag: { span_error_attributes: true, }
    }

    const agent = helper.instrumentMockedAgent(config)
    const api = new API(agent)

    let spanIds = []
    const numErrors = 3

    agent.on('transactionFinished', () => {
      const errorEvents = agent.errors.eventAggregator.getEvents()
      const errorEventSpanIds = errorEvents.map(e => e[2].spanId)

      t.same(
        new Set(spanIds), new Set(errorEventSpanIds),
        'Every TransactionError event should have a unique span ID'
      )

      t.equal(errorEvents.length, numErrors, 'Every error was reported')

      const spanEvents = agent.spanEventAggregator.getEvents()

      spanEvents.forEach(s => {
        const attrs = s.attributes
        t.match(attrs['error.message'], /test[0-9]/,
          'Error attributes are on the spans'
        )

        t.match(attrs['error.name'], 'Unknown',
          'Error attributes are on the spans'
        )

        t.match(attrs['error.type'], 'Error',
          'Error attributes are on the spans'
        )
      })

      t.equal(spanEvents.length, numErrors, 'Every span was reported')
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

    helper.unloadAgent(agent)

    t.end()
  })

  t.test("Span error attributes aren't added with LASP/HSM", (t) => {
    const config = {
      distributed_tracing: { enabled: true },
      feature_flag: { span_error_attributes: true, },
      high_security: true
    }

    const agent = helper.instrumentMockedAgent(config)
    const api = new API(agent)

    let spanId

    agent.on('transactionFinished', () => {
      const spanEvent = agent.spanEventAggregator.getEvents()[0]
      const attrs = spanEvent.attributes
      t.ok(spanEvent.intrinsics.guid === spanId && !attrs['error.message'],
        'There should be no error message on the span'
      )
    })

    helper.runInTransaction(agent, (tx) => {
      api.startSegment('segment', true, () => {
        const segment = api.shim.getSegment()
        spanId = segment.id
        api.noticeError(new Error('test'))
      })

      tx.end()
    })

    helper.unloadAgent(agent)

    t.end()
  })

  t.test("Span error attributes aren't added with ignored errors", (t) => {
    const config = {
      distributed_tracing: { enabled: true },
      feature_flag: { span_error_attributes: true, },
      error_collector: { ignore_classes: ['CustomError'] }
    }

    const agent = helper.instrumentMockedAgent(config)
    const api = new API(agent)

    let ignoredSpanId
    let spanId

    agent.on('transactionFinished', () => {
      const errorEvents = agent.errors.eventAggregator.getEvents()
      const spanEvents = agent.spanEventAggregator.getEvents()
      const ignoredSpanEvent = spanEvents.filter(s => s.intrinsics.guid === ignoredSpanId)[0]
      const spanEvent = spanEvents.filter(s => s.intrinsics.guid === spanId)[0]

      t.ok(errorEvents.length === 1 && errorEvents[0][2].spanId === spanId,
        'There should only be the non-ignored error reported'
      )

      t.ok(spanEvent.attributes['error.message'] === 'not ignored',
        'There non-ignored error should be reported'
      )

      t.notOk(ignoredSpanEvent.attributes['error.message'],
        'There ignored error should not be reported'
      )
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

    helper.unloadAgent(agent)

    t.end()
  })

  t.end()
})
