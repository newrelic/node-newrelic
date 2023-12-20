/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('../../lib/metrics_helper')
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

function beforeEach(t) {
  const agent = helper.loadMockedAgent({
    distributed_tracing: {
      enabled: true
    },
    cross_application_tracer: { enabled: true }
  })
  // Set the DT required data after config runs, since they'll be cleared when
  // not in serverless_mode
  ;(agent.config.account_id = '1234'),
    (agent.config.primary_application_id = '5678'),
    (agent.config.trusted_account_key = '1234')
  t.context.tx = new Transaction(agent)
  t.context.agent = agent
}

function afterEach(t) {
  helper.unloadAgent(t.context.agent)
}

tap.test('recordDistributedTrace', (t) => {
  t.autoend()
  t.test('when a trace payload was received', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('records metrics with payload information', (t) => {
      const { tx } = t.context
      const payload = tx._createDistributedTracePayload().text()
      tx.isDistributedTrace = null
      tx._acceptDistributedTracePayload(payload, 'HTTP')

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

      t.assertMetrics(tx.metrics, result, true, true)
      t.end()
    })

    t.test('and transaction errors exist includes error-related metrics', (t) => {
      const { tx } = t.context
      const payload = tx._createDistributedTracePayload().text()
      tx.isDistributedTrace = null
      tx._acceptDistributedTracePayload(payload, 'HTTP')

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

      t.assertMetrics(tx.metrics, result, true, true)
      t.end()
    })
  })

  t.test('when no trace payload was received', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('records metrics with Unknown payload information', (t) => {
      const { tx } = t.context
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

      t.assertMetrics(tx.metrics, result, true, true)
      t.end()
    })
  })
})
