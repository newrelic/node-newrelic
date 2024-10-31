/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { assertMetricValues } = require('../../lib/custom-assertions')
const recordWeb = require('../../../lib/metrics/recorders/http')
const Transaction = require('../../../lib/transaction')

function makeSegment(options) {
  const segment = options.transaction.trace.add('placeholder')
  segment.setDurationInMillis(options.duration)
  segment._setExclusiveDurationInMillis(options.exclusive)

  return segment
}

function record(options) {
  if (options.apdexT) {
    options.transaction.metrics.apdexT = options.apdexT
  }

  const segment = makeSegment(options)
  const transaction = options.transaction

  transaction.finalizeNameFromUri(options.url, options.code)
  transaction.queueTime = options.queueTime
  segment.markAsWeb(transaction)
  recordWeb(segment, options.transaction.name, options.transaction)
}

test('when recording queueTime', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
    ctx.nr.trans = new Transaction(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('non zero times should record a metric', (t) => {
    const { trans } = t.nr
    record({
      transaction: trans,
      apdexT: 0.2,
      url: '/test',
      code: 200,
      duration: 1,
      exclusive: 1,
      queueTime: 2200
    })

    const result = [
      [{ name: 'WebTransaction' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{ name: 'WebTransactionTotalTime' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{ name: 'HttpDispatcher' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{ name: 'WebTransaction/NormalizedUri/*' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [
        { name: 'WebTransactionTotalTime/NormalizedUri/*' },
        [1, 0.001, 0.001, 0.001, 0.001, 0.000001]
      ],
      [
        { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all' },
        [1, 0.001, 0.001, 0.001, 0.001, 0.000001]
      ],
      [
        { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allWeb' },
        [1, 0.001, 0.001, 0.001, 0.001, 0.000001]
      ],
      [{ name: 'WebFrontend/QueueTime' }, [1, 2.2, 2.2, 2.2, 2.2, 4.840000000000001]],
      [{ name: 'Apdex/NormalizedUri/*' }, [1, 0, 0, 0.2, 0.2, 0]],
      [{ name: 'Apdex' }, [1, 0, 0, 0.2, 0.2, 0]]
    ]

    assertMetricValues(trans, result, true)
  })

  await t.test('zero times should not record a metric', (t) => {
    const { trans } = t.nr
    record({
      transaction: trans,
      apdexT: 0.2,
      url: '/test',
      code: 200,
      duration: 1,
      exclusive: 1,
      queueTime: 0
    })

    const result = [
      [{ name: 'WebTransaction' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{ name: 'WebTransactionTotalTime' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{ name: 'HttpDispatcher' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [{ name: 'WebTransaction/NormalizedUri/*' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
      [
        { name: 'WebTransactionTotalTime/NormalizedUri/*' },
        [1, 0.001, 0.001, 0.001, 0.001, 0.000001]
      ],
      [
        { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all' },
        [1, 0.001, 0.001, 0.001, 0.001, 0.000001]
      ],
      [
        { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allWeb' },
        [1, 0.001, 0.001, 0.001, 0.001, 0.000001]
      ],
      [{ name: 'Apdex/NormalizedUri/*' }, [1, 0, 0, 0.2, 0.2, 0]],
      [{ name: 'Apdex' }, [1, 0, 0, 0.2, 0.2, 0]]
    ]
    assertMetricValues(trans, result, true)
  })
})
