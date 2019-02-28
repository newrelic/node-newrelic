'use strict'

const helper = require('../../lib/agent_helper')
const assertMetrics = require('../../lib/metrics_helper').assertMetrics
const recordDistributedTrace = require('../../../lib/metrics/recorders/distributed-trace')
const Transaction = require('../../../lib/transaction')

const makeSegment = (opts) => {
  const segment = opts.tx.trace.root.add('placeholder')
  segment.setDurationInMillis(opts.duration)
  segment._setExclusiveDurationInMillis(opts.exclusive)

  return segment
}

const record = (opts) => {
  const segment = makeSegment(opts)
  const tx = opts.tx

  const duration = segment.getDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis()

  recordDistributedTrace(tx, opts.type, duration, exclusive)
}

describe('recordDistributedTrace', () => {
  let agent
  let tx

  beforeEach(() => {
    agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true
      },
      cross_application_tracer: { enabled: true },
    })
    // Set the DT required data after config runs, since they'll be cleared when
    // not in serverless_mode
    agent.config.account_id = '1234',
    agent.config.primary_application_id = '5678',
    agent.config.trusted_account_key = '1234'
    tx = new Transaction(agent)
  })

  afterEach(() => {
    helper.unloadAgent(agent)
  })

  describe('when a trace payload was received', () => {
    it('records metrics with payload information', () => {
      const payload = tx.createDistributedTracePayload().text()
      tx.isDistributedTrace = null
      tx.acceptDistributedTracePayload(payload, 'HTTP')

      record({
        tx,
        duration: 55,
        exclusive: 55,
        type: 'Web'
      })

      const result = [
        [
          { name: 'DurationByCaller/App/1234/5678/HTTP/all' },
          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
        ],
        [
          { name: 'TransportDuration/App/1234/5678/HTTP/all' },
          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
        ],
        [
          { name: 'DurationByCaller/App/1234/5678/HTTP/allWeb' },
          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
        ],
        [
          { name: 'TransportDuration/App/1234/5678/HTTP/allWeb' },
          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
        ]
      ]

      assertMetrics(tx.metrics, result, true, true)
    })

    describe('and transaction errors exist', () => {
      it('includes error-related metrics', () => {
        const payload = tx.createDistributedTracePayload().text()
        tx.isDistributedTrace = null
        tx.acceptDistributedTracePayload(payload, 'HTTP')

        tx.exceptions.push('some error')

        record({
          tx,
          duration: 55,
          exclusive: 55,
          type: 'Web'
        })

        const result = [
          [
            { name: 'DurationByCaller/App/1234/5678/HTTP/all' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'ErrorsByCaller/App/1234/5678/HTTP/all' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'TransportDuration/App/1234/5678/HTTP/all' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'DurationByCaller/App/1234/5678/HTTP/allWeb' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'ErrorsByCaller/App/1234/5678/HTTP/allWeb' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'TransportDuration/App/1234/5678/HTTP/allWeb' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ]
        ]

        assertMetrics(tx.metrics, result, true, true)
      })
    })
  })

  describe('when no trace payload was received', () => {
    it('records metrics with Unknown payload information', () => {
      record({
        tx,
        duration: 55,
        exclusive: 55,
        type: 'Web'
      })

      const result = [
        [
          { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all' },
          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
        ],
        [
          { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allWeb' },
          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
        ]
      ]

      assertMetrics(tx.metrics, result, true, true)
    })
  })
})
