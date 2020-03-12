'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')

tap.test('span error attributes', (t) => {
  const config = {
    distributed_tracing: {
      enabled: true
    },
    feature_flag: {
      span_error_attributes: true,
    },
    cross_application_tracer: {enabled: false},
    account_id: '1337',
    primary_application_id: '7331',
    trusted_account_key: '1337',
    encoding_key: 'some key',
  }

  const agent = helper.instrumentMockedAgent(config)

  agent.config.account_id = '1337'
  agent.config.primary_application_id = '7331'
  agent.config.trusted_account_key = '1337'

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

      t.match(attrs['error.name'], 'Error',
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

  // t.test("Span error attributes aren't added with LASP/HSM", (t) => {
  //   t.end()
  // })
  //
  // t.test("Span error attributes aren't added with ignored errors", (t) => {
  //   t.end()
  // })

  t.end()
})
