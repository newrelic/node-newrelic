/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const chai = require('chai')
const expect = chai.expect
const helper = require('../../lib/agent_helper')
const assertMetrics = require('../../lib/metrics_helper').assertMetrics
const recordWeb = require('../../../lib/metrics/recorders/http')
const Transaction = require('../../../lib/transaction')

function makeSegment(options) {
  const segment = options.transaction.trace.root.add('placeholder')
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
  segment.markAsWeb(options.url)
  recordWeb(segment, options.transaction.name)
}

describe('recordWeb', function () {
  let agent
  let trans

  beforeEach(function () {
    agent = helper.instrumentMockedAgent()
    trans = new Transaction(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  describe('when scope is undefined', function () {
    let segment

    beforeEach(function () {
      segment = makeSegment({
        transaction: trans,
        duration: 0,
        exclusive: 0
      })
    })

    it("shouldn't crash on recording", function () {
      expect(function () {
        recordWeb(segment, undefined)
      }).not.throws()
    })

    it('should record no metrics', function () {
      recordWeb(segment, undefined)
      assertMetrics(trans.metrics, [], true, true)
    })
  })

  describe('when recording web transactions', function () {
    describe('with distributed tracing enabled', function () {
      it('should record metrics from accepted payload information', function () {
        agent.config.distributed_tracing.enabled = true
        agent.config.cross_application_tracer.enabled = true
        agent.config.account_id = '1234'
        ;(agent.config.primary_application_id = '5677'), (agent.config.trusted_account_key = '1234')

        const payload = trans._createDistributedTracePayload().text()
        trans.isDistributedTrace = null
        trans._acceptDistributedTracePayload(payload, 'HTTP')

        record({
          transaction: trans,
          apdexT: 0.06,
          url: '/test',
          code: 200,
          duration: 55,
          exclusive: 55
        })

        const result = [
          [{ name: 'WebTransaction' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransactionTotalTime' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'HttpDispatcher' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransaction/NormalizedUri/*' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [
            { name: 'WebTransactionTotalTime/NormalizedUri/*' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'DurationByCaller/App/1234/5677/HTTP/all' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'TransportDuration/App/1234/5677/HTTP/all' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'DurationByCaller/App/1234/5677/HTTP/allWeb' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'TransportDuration/App/1234/5677/HTTP/allWeb' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [{ name: 'Apdex/NormalizedUri/*' }, [1, 0, 0, 0.06, 0.06, 0]],
          [{ name: 'Apdex' }, [1, 0, 0, 0.06, 0.06, 0]]
        ]

        assertMetrics(trans.metrics, result, true, true)
      })

      it('should tag metrics with Unknown if no DT payload was received', function () {
        agent.config.distributed_tracing.enabled = true
        agent.config.cross_application_tracer.enabled = true
        agent.config.account_id = '1234'
        ;(agent.config.primary_application_id = '5677'), (agent.config.trusted_account_key = '1234')

        record({
          transaction: trans,
          apdexT: 0.06,
          url: '/test',
          code: 200,
          duration: 55,
          exclusive: 55
        })

        const result = [
          [{ name: 'WebTransaction' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransactionTotalTime' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'HttpDispatcher' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransaction/NormalizedUri/*' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [
            { name: 'WebTransactionTotalTime/NormalizedUri/*' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [
            { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allWeb' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [{ name: 'Apdex/NormalizedUri/*' }, [1, 0, 0, 0.06, 0.06, 0]],
          [{ name: 'Apdex' }, [1, 0, 0, 0.06, 0.06, 0]]
        ]

        assertMetrics(trans.metrics, result, true, true)
      })
    })

    describe('with normal requests', function () {
      it('should infer a satisfying end-user experience', function () {
        agent.config.distributed_tracing.enabled = false

        record({
          transaction: trans,
          apdexT: 0.06,
          url: '/test',
          code: 200,
          duration: 55,
          exclusive: 55
        })

        const result = [
          [{ name: 'WebTransaction' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransactionTotalTime' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'HttpDispatcher' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransaction/NormalizedUri/*' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [
            { name: 'WebTransactionTotalTime/NormalizedUri/*' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [{ name: 'Apdex/NormalizedUri/*' }, [1, 0, 0, 0.06, 0.06, 0]],
          [{ name: 'Apdex' }, [1, 0, 0, 0.06, 0.06, 0]]
        ]
        assertMetrics(trans.metrics, result, true, true)
      })

      it('should infer a tolerable end-user experience', function () {
        agent.config.distributed_tracing.enabled = false

        record({
          transaction: trans,
          apdexT: 0.05,
          url: '/test',
          code: 200,
          duration: 55,
          exclusive: 100
        })

        const result = [
          [{ name: 'WebTransaction' }, [1, 0.055, 0.1, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransactionTotalTime' }, [1, 0.1, 0.1, 0.1, 0.1, 0.010000000000000002]],
          [{ name: 'HttpDispatcher' }, [1, 0.055, 0.1, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransaction/NormalizedUri/*' }, [1, 0.055, 0.1, 0.055, 0.055, 0.003025]],
          [
            { name: 'WebTransactionTotalTime/NormalizedUri/*' },
            [1, 0.1, 0.1, 0.1, 0.1, 0.010000000000000002]
          ],
          [{ name: 'Apdex/NormalizedUri/*' }, [0, 1, 0, 0.05, 0.05, 0]],
          [{ name: 'Apdex' }, [0, 1, 0, 0.05, 0.05, 0]]
        ]
        assertMetrics(trans.metrics, result, true, true)
      })

      it('should infer a frustrating end-user experience', function () {
        agent.config.distributed_tracing.enabled = false

        record({
          transaction: trans,
          apdexT: 0.01,
          url: '/test',
          code: 200,
          duration: 55,
          exclusive: 55
        })

        const result = [
          [{ name: 'WebTransaction' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransactionTotalTime' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'HttpDispatcher' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{ name: 'WebTransaction/NormalizedUri/*' }, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [
            { name: 'WebTransactionTotalTime/NormalizedUri/*' },
            [1, 0.055, 0.055, 0.055, 0.055, 0.003025]
          ],
          [{ name: 'Apdex/NormalizedUri/*' }, [0, 0, 1, 0.01, 0.01, 0]],
          [{ name: 'Apdex' }, [0, 0, 1, 0.01, 0.01, 0]]
        ]
        assertMetrics(trans.metrics, result, true, true)
      })

      it('should chop query strings delimited by ? from request URLs', function () {
        record({
          transaction: trans,
          url: '/test?test1=value1&test2&test3=50'
        })

        expect(trans.url).equal('/test')
      })

      it('should chop query strings delimited by ; from request URLs', function () {
        record({
          transaction: trans,
          url: '/test;jsessionid=c83048283dd1328ac21aed8a8277d'
        })

        expect(trans.url).equal('/test')
      })
    })

    describe('with exceptional requests', function () {
      it('should handle internal server errors', function () {
        agent.config.distributed_tracing.enabled = false

        record({
          transaction: trans,
          apdexT: 0.01,
          url: '/test',
          code: 500,
          duration: 1,
          exclusive: 1
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
          [{ name: 'Apdex/NormalizedUri/*' }, [0, 0, 1, 0.01, 0.01, 0]],
          [{ name: 'Apdex' }, [0, 0, 1, 0.01, 0.01, 0]]
        ]
        assertMetrics(trans.metrics, result, true, true)
      })
    })
  })

  describe("when testing a web request's apdex", function () {
    it("shouldn't automatically mark ignored status codes as frustrating", function () {
      // FIXME: probably shouldn't do all this through side effects
      trans.statusCode = 404
      trans._setApdex('Apdex/Uri/test', 30)
      const result = [[{ name: 'Apdex/Uri/test' }, [1, 0, 0, 0.1, 0.1, 0]]]
      expect(agent.config.error_collector.ignore_status_codes).deep.equal([404])
      assertMetrics(trans.metrics, result, true, true)
    })

    it('should handle ignored codes for the whole transaction', function () {
      agent.config.distributed_tracing.enabled = false
      agent.config.error_collector.ignore_status_codes = [404, 500]

      record({
        transaction: trans,
        apdexT: 0.2,
        url: '/test',
        code: 500,
        duration: 1,
        exclusive: 1
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
        [{ name: 'Apdex/NormalizedUri/*' }, [1, 0, 0, 0.2, 0.2, 0]],
        [{ name: 'Apdex' }, [1, 0, 0, 0.2, 0.2, 0]]
      ]
      assertMetrics(trans.metrics, result, true, true)
    })

    it('should otherwise mark error status codes as frustrating', function () {
      // FIXME: probably shouldn't do all this through side effects
      trans.statusCode = 503
      trans._setApdex('Apdex/Uri/test', 30)
      const result = [[{ name: 'Apdex/Uri/test' }, [0, 0, 1, 0.1, 0.1, 0]]]
      assertMetrics(trans.metrics, result, true, true)
    })

    it('should handle non-ignored codes for the whole transaction', function () {
      agent.config.distributed_tracing.enabled = false
      record({
        transaction: trans,
        apdexT: 0.2,
        url: '/test',
        code: 503,
        duration: 1,
        exclusive: 1
      })

      const result = [
        [{ name: 'WebTransaction' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [{ name: 'HttpDispatcher' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [{ name: 'WebTransaction/NormalizedUri/*' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [{ name: 'WebTransactionTotalTime' }, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [
          { name: 'WebTransactionTotalTime/NormalizedUri/*' },
          [1, 0.001, 0.001, 0.001, 0.001, 0.000001]
        ],
        [{ name: 'Apdex/NormalizedUri/*' }, [0, 0, 1, 0.2, 0.2, 0]],
        [{ name: 'Apdex' }, [0, 0, 1, 0.2, 0.2, 0]]
      ]
      assertMetrics(trans.metrics, result, true, true)
    })

    it('should reflect key transaction apdexT', function () {
      agent.config.web_transactions_apdex = {
        'WebTransaction/WebFrameworkUri/TestJS//key/:id': 0.667,
        // just to make sure
        'WebTransaction/WebFrameworkUri/TestJS//another/:name': 0.444
      }
      trans.nameState.setName('TestJS', null, '/', '/key/:id')

      record({
        transaction: trans,
        apdexT: 0.2,
        url: '/key/23',
        code: 200,
        duration: 1200,
        exclusive: 1200
      })

      const result = [
        [{ name: 'WebTransaction' }, [1, 1.2, 1.2, 1.2, 1.2, 1.44]],
        [{ name: 'HttpDispatcher' }, [1, 1.2, 1.2, 1.2, 1.2, 1.44]],
        [{ name: 'WebTransaction/WebFrameworkUri/TestJS//key/:id' }, [1, 1.2, 1.2, 1.2, 1.2, 1.44]],
        [
          { name: 'WebTransactionTotalTime/WebFrameworkUri/TestJS//key/:id' },
          [1, 1.2, 1.2, 1.2, 1.2, 1.44]
        ],
        [{ name: 'WebTransactionTotalTime' }, [1, 1.2, 1.2, 1.2, 1.2, 1.44]],
        [
          { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all' },
          [1, 1.2, 1.2, 1.2, 1.2, 1.44]
        ],
        [
          { name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allWeb' },
          [1, 1.2, 1.2, 1.2, 1.2, 1.44]
        ],
        [{ name: 'Apdex/WebFrameworkUri/TestJS//key/:id' }, [0, 1, 0, 0.667, 0.667, 0]],
        [{ name: 'Apdex' }, [0, 1, 0, 0.2, 0.2, 0]]
      ]
      assertMetrics(trans.metrics, result, true, true)
    })
  })
})
