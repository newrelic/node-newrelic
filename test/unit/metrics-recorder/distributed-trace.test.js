/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { assertMetrics } = require('../../lib/custom-assertions')
const recordDistributedTrace = require('../../../lib/metrics/recorders/distributed-trace')
const Transaction = require('../../../lib/transaction')

const makeSegment = (opts) => {
  const segment = opts.tx.trace.add('placeholder')
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

function beforeEach(ctx) {
  ctx.nr = {}
  const agent = helper.loadMockedAgent({
    distributed_tracing: {
      enabled: true
    },
    cross_application_tracer: { enabled: true }
  })
  // Set the DT required data after config runs, since they'll be cleared when
  // not in serverless_mode
  agent.config.distributed_tracing.account_id = '1234'
  agent.config.primary_application_id = '5678'
  agent.config.trusted_account_key = '1234'
  ctx.nr.tx = new Transaction(agent)
  ctx.nr.agent = agent
}

function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
}

test('recordDistributedTrace', async (t) => {
  await t.test('when a trace payload was received', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('records metrics with payload information', (t) => {
      const { tx } = t.nr
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

      assertMetrics(tx.metrics, result, true, true)
    })

    await t.test('and transaction errors exist includes error-related metrics', (t) => {
      const { tx } = t.nr
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

      assertMetrics(tx.metrics, result, true, true)
    })
  })

  await t.test('when no trace payload was received', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('records metrics with Unknown payload information', (t) => {
      const { tx } = t.nr
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
