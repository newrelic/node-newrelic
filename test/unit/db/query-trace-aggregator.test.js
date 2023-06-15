/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const Config = require('../../../lib/config')
const QueryTraceAggregator = require('../../../lib/db/query-trace-aggregator')
const codec = require('../../../lib/util/codec')
const { FakeSegment, FakeTransaction } = require('../../lib/agent_helper')

const FAKE_STACK = 'Error\nfake stack'

tap.test('Query Trace Aggregator', (t) => {
  t.autoend()

  t.test('when no queries in payload, _toPayload should exec callback with null data', (t) => {
    const opts = {
      config: new Config({
        slow_sql: { enabled: false },
        transaction_tracer: { record_sql: 'off', explain_threshold: 500 }
      }),
      method: 'sql_trace_data'
    }
    const queries = new QueryTraceAggregator(opts)

    let cbCalledWithNull = false

    const cb = (err, data) => {
      if (data === null) {
        cbCalledWithNull = true
      }
    }

    queries._toPayload(cb)

    t.ok(cbCalledWithNull)
    t.end()
  })

  t.test('when slow_sql.enabled is false', (t) => {
    t.autoend()
    t.test('should not record anything when transaction_tracer.record_sql === "off"', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'off', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 1000)
      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 0)
      t.same(segment.getAttributes(), {}, 'should not record sql in trace')
      t.end()
    })

    t.test('should treat unknown value in transaction_tracer.record_sql as off', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'something else', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 1000)
      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 0)
      t.same(segment.getAttributes(), {}, 'should not record sql in trace')
      t.end()
    })

    t.test('should record only in trace when record_sql === "obfuscated"', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 1000)
      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 0)
      t.same(
        segment.getAttributes(),
        {
          backtrace: 'fake stack',
          sql_obfuscated: 'select * from foo where a=?'
        },
        'should record sql in trace'
      )
      t.end()
    })

    t.test('should record only in trace when record_sql === "raw"', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 1000)
      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 0)
      t.same(
        segment.getAttributes(),
        {
          backtrace: 'fake stack',
          sql: 'select * from foo where a=2'
        },
        'should record sql in trace'
      )
      t.end()
    })

    t.test('should not record if below threshold', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 100)
      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 0)
      t.same(
        segment.getAttributes(),
        {
          sql: 'select * from foo where a=2'
        },
        'should record sql in trace'
      )
      t.end()
    })
  })

  t.test('when slow_sql.enabled is true', (t) => {
    t.autoend()

    t.test('should not record anything when transaction_tracer.record_sql === "off"', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'off', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 1000)
      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 0)
      t.same(segment.getAttributes(), {}, 'should not record sql in trace')
      t.end()
    })

    t.test('should treat unknown value in transaction_tracer.record_sql as off', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'something else', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 1000)
      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 0)
      t.same(segment.getAttributes(), {}, 'should not record sql in trace')
      t.end()
    })

    t.test('should record obfuscated trace when record_sql === "obfuscated"', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 1000)
      t.same(
        segment.getAttributes(),
        {
          backtrace: 'fake stack',
          sql_obfuscated: 'select * from foo where a=?'
        },
        'should not record sql in trace'
      )

      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 1)
      t.ok(queries.samples.has('select*fromfoowherea=?'))

      const sample = queries.samples.get('select*fromfoowherea=?')
      verifySample(t, sample, 1, segment)
      t.end()
    })

    t.test('should record raw when record_sql === "raw"', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 1000)
      t.same(
        segment.getAttributes(),
        {
          backtrace: 'fake stack',
          sql: 'select * from foo where a=2'
        },
        'should not record sql in trace'
      )

      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 1)
      t.ok(queries.samples.has('select*fromfoowherea=?'))

      const sample = queries.samples.get('select*fromfoowherea=?')
      verifySample(t, sample, 1, segment)
      t.end()
    })

    t.test('should not record if below threshold', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const segment = addQuery(queries, 100)
      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 0)
      t.same(
        segment.getAttributes(),
        {
          sql: 'select * from foo where a=2'
        },
        'should record sql in trace'
      )
      t.end()
    })
  })

  t.test('prepareJSON', (t) => {
    t.autoend()

    t.test('webTransaction when record_sql is "raw"', (t) => {
      t.autoend()

      let queries

      t.beforeEach(() => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        queries = new QueryTraceAggregator(opts)
      })

      t.test('and `simple_compression` is `false`', (t) => {
        t.autoend()

        t.beforeEach(() => {
          queries.config.simple_compression = false
        })

        t.test('should compress the query parameters', (t) => {
          addQuery(queries, 600, '/abc')

          queries.prepareJSON(function preparedJSON(err, data) {
            const sample = data[0]

            codec.decode(sample[9], function decoded(error, params) {
              t.equal(error, null, 'should not error')

              const keys = Object.keys(params)

              t.same(keys, ['backtrace'])
              t.same(params.backtrace, 'fake stack', 'trace should match')
              t.end()
            })
          })
        })
      })

      t.test('and `simple_compression` is `true`', (t) => {
        t.autoend()

        t.beforeEach(() => {
          queries.config.simple_compression = true
        })

        t.test('should not compress the query parameters', (t) => {
          addQuery(queries, 600, '/abc')

          queries.prepareJSON(function preparedJSON(err, data) {
            const sample = data[0]
            const params = sample[9]
            const keys = Object.keys(params)

            t.same(keys, ['backtrace'])
            t.same(params.backtrace, 'fake stack', 'trace should match')
            t.end()
          })
        })
      })

      t.test('should record work when empty', (t) => {
        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.same(data, [], 'should return empty array')
          t.end()
        })
      })

      t.test('should record work with a single query', (t) => {
        addQuery(queries, 600, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 1, 'should be 1 sample query')

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '/abc', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 1, 'should have 1 call')
          t.equal(sample[6], 600, 'should match total')
          t.equal(sample[7], 600, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            t.end()
          })
        })
      })

      t.test('should record work with a multiple similar queries', (t) => {
        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '/abc', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 2, 'should have 1 call')
          t.equal(sample[6], 1150, 'should match total')
          t.equal(sample[7], 550, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            t.end()
          })
        })
      })

      t.test('should record work with a multiple unique queries', (t) => {
        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc', 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 2, 'should be 2 sample queries')

          data.sort(function compareTotalTimeDesc(lhs, rhs) {
            const rhTotal = rhs[6]
            const lhTotal = lhs[6]

            return rhTotal - lhTotal
          })

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '/abc', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 1, 'should have 1 call')
          t.equal(sample[6], 600, 'should match total')
          t.equal(sample[7], 600, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            nextSample()
          })

          function nextSample() {
            const sample2 = data[1]

            t.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            t.equal(sample2[1], '/abc', 'should match transaction url')
            t.equal(sample2[2], 487602586913804700, 'should match query id')
            t.equal(sample2[3], 'drop table users', 'should match raw query')
            t.equal(sample2[4], 'FakeSegment', 'should match segment name')
            t.equal(sample2[5], 1, 'should have 1 call')
            t.equal(sample2[6], 550, 'should match total')
            t.equal(sample2[7], 550, 'should match min')
            t.equal(sample2[8], 550, 'should match max')

            codec.decode(sample2[9], function decoded(error, result) {
              t.equal(error, null, 'should not error')

              const keys = Object.keys(result)

              t.same(keys, ['backtrace'])
              t.same(result.backtrace, 'fake stack', 'trace should match')
              t.end()
            })
          }
        })
      })
    })

    t.test('webTransaction when record_sql is "obfuscated"', (t) => {
      t.autoend()

      t.test('should record work when empty', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.same(data, [], 'should return empty array')
          t.end()
        })
      })

      t.test('should record work with a single query', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        addQuery(queries, 600, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 1, 'should be 1 sample query')

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '/abc', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 1, 'should have 1 call')
          t.equal(sample[6], 600, 'should match total')
          t.equal(sample[7], 600, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            t.end()
          })
        })
      })

      t.test('should record work with a multiple similar queries', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '/abc', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 2, 'should have 1 call')
          t.equal(sample[6], 1150, 'should match total')
          t.equal(sample[7], 550, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            t.end()
          })
        })
      })

      t.test('should record work with a multiple unique queries', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc', 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 2, 'should be 1 sample query')

          data.sort(function compareTotalTimeDesc(lhs, rhs) {
            const rhTotal = rhs[6]
            const lhTotal = lhs[6]

            return rhTotal - lhTotal
          })

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '/abc', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 1, 'should have 1 call')
          t.equal(sample[6], 600, 'should match total')
          t.equal(sample[7], 600, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')

            const sample2 = data[1]
            t.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            t.equal(sample2[1], '/abc', 'should match transaction url')
            t.equal(sample2[2], 487602586913804700, 'should match query id')
            t.equal(sample2[3], 'drop table users', 'should match raw query')
            t.equal(sample2[4], 'FakeSegment', 'should match segment name')
            t.equal(sample2[5], 1, 'should have 1 call')
            t.equal(sample2[6], 550, 'should match total')
            t.equal(sample2[7], 550, 'should match min')
            t.equal(sample2[8], 550, 'should match max')

            codec.decode(sample2[9], function (error, nextResult) {
              t.equal(error, null, 'should not error')

              const nextKey = Object.keys(nextResult)

              t.same(nextKey, ['backtrace'])
              t.same(nextResult.backtrace, 'fake stack', 'trace should match')
              t.end()
            })
          })
        })
      })
    })

    t.test('backgroundTransaction when record_sql is "raw"', (t) => {
      t.autoend()

      t.test('should record work when empty', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.same(data, [], 'should return empty array')
          t.end()
        })
      })

      t.test('should record work with a single query', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        addQuery(queries, 600, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 1, 'should be 1 sample query')

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '<unknown>', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 1, 'should have 1 call')
          t.equal(sample[6], 600, 'should match total')
          t.equal(sample[7], 600, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            t.end()
          })
        })
      })

      t.test('should record work with a multiple similar queries', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        addQuery(queries, 600, null)
        addQuery(queries, 550, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '<unknown>', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 2, 'should have 1 call')
          t.equal(sample[6], 1150, 'should match total')
          t.equal(sample[7], 550, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            t.end()
          })
        })
      })

      t.test('should record work with a multiple unique queries', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        addQuery(queries, 600, null)
        addQuery(queries, 550, null, 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 2, 'should be 1 sample query')

          data.sort(function compareTotalTimeDesc(lhs, rhs) {
            const rhTotal = rhs[6]
            const lhTotal = lhs[6]

            return rhTotal - lhTotal
          })

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '<unknown>', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 1, 'should have 1 call')
          t.equal(sample[6], 600, 'should match total')
          t.equal(sample[7], 600, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            nextSample()
          })

          function nextSample() {
            const sample2 = data[1]
            t.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            t.equal(sample2[1], '<unknown>', 'should match transaction url')
            t.equal(sample2[2], 487602586913804700, 'should match query id')
            t.equal(sample2[3], 'drop table users', 'should match raw query')
            t.equal(sample2[4], 'FakeSegment', 'should match segment name')
            t.equal(sample2[5], 1, 'should have 1 call')
            t.equal(sample2[6], 550, 'should match total')
            t.equal(sample2[7], 550, 'should match min')
            t.equal(sample2[8], 550, 'should match max')

            codec.decode(sample2[9], function decoded(error, result) {
              t.equal(error, null, 'should not error')

              const keys = Object.keys(result)

              t.same(keys, ['backtrace'])
              t.same(result.backtrace, 'fake stack', 'trace should match')
              t.end()
            })
          }
        })
      })
    })

    t.test('background when record_sql is "obfuscated"', (t) => {
      t.autoend()

      t.test('should record work when empty', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.same(data, [], 'should return empty array')
          t.end()
        })
      })

      t.test('should record work with a single query', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        addQuery(queries, 600, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 1, 'should be 1 sample query')

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '<unknown>', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 1, 'should have 1 call')
          t.equal(sample[6], 600, 'should match total')
          t.equal(sample[7], 600, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            t.end()
          })
        })
      })

      t.test('should record work with a multiple similar queries', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        addQuery(queries, 600, null)
        addQuery(queries, 550, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '<unknown>', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 2, 'should have 1 call')
          t.equal(sample[6], 1150, 'should match total')
          t.equal(sample[7], 550, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')
            t.end()
          })
        })
      })

      t.test('should record work with a multiple unique queries', (t) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const queries = new QueryTraceAggregator(opts)

        addQuery(queries, 600, null)
        addQuery(queries, 550, null, 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          t.equal(err, null, 'should not error')
          t.equal(data.length, 2, 'should be 1 sample query')

          data.sort(function compareTotalTimeDesc(lhs, rhs) {
            const rhTotal = rhs[6]
            const lhTotal = lhs[6]

            return rhTotal - lhTotal
          })

          const sample = data[0]
          t.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          t.equal(sample[1], '<unknown>', 'should match transaction url')
          t.equal(sample[2], 374780417029088500, 'should match query id')
          t.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          t.equal(sample[4], 'FakeSegment', 'should match segment name')
          t.equal(sample[5], 1, 'should have 1 call')
          t.equal(sample[6], 600, 'should match total')
          t.equal(sample[7], 600, 'should match min')
          t.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            t.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            t.same(keys, ['backtrace'])
            t.same(result.backtrace, 'fake stack', 'trace should match')

            const sample2 = data[1]
            t.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            t.equal(sample2[1], '<unknown>', 'should match transaction url')
            t.equal(sample2[2], 487602586913804700, 'should match query id')
            t.equal(sample2[3], 'drop table users', 'should match raw query')
            t.equal(sample2[4], 'FakeSegment', 'should match segment name')
            t.equal(sample2[5], 1, 'should have 1 call')
            t.equal(sample2[6], 550, 'should match total')
            t.equal(sample2[7], 550, 'should match min')
            t.equal(sample2[8], 550, 'should match max')

            codec.decode(sample2[9], function (error, nextResult) {
              t.equal(error, null, 'should not error')

              const nextKeys = Object.keys(nextResult)

              t.same(nextKeys, ['backtrace'])
              t.same(nextResult.backtrace, 'fake stack', 'trace should match')
              t.end()
            })
          })
        })
      })
    })
  })

  t.test('limiting to n slowest', (t) => {
    t.autoend()

    t.test('should limit to this.config.max_samples', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true, max_samples: 2 },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      addQuery(queries, 600, null)
      addQuery(queries, 550, null, 'create table users')

      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 2)
      t.ok(queries.samples.has('select*fromfoowherea=?'))
      t.ok(queries.samples.has('createtableusers'))

      addQuery(queries, 650, null, 'drop table users')

      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 2)
      t.ok(queries.samples.has('select*fromfoowherea=?'))
      t.ok(queries.samples.has('droptableusers'))
      t.end()
    })
  })

  t.test('merging query tracers', (t) => {
    t.autoend()

    t.test('should merge queries correctly', (t) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries = new QueryTraceAggregator(opts)

      const opts2 = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries2 = new QueryTraceAggregator(opts2)

      addQuery(queries, 600, null)
      addQuery(queries, 650, null, 'create table users')
      addQuery(queries2, 800, null)
      addQuery(queries2, 500, null, 'create table users')

      queries._merge(queries2.samples)

      t.hasProp(queries.samples, 'size')
      t.equal(queries.samples.size, 2)
      t.ok(queries.samples.has('select*fromfoowherea=?'))
      t.ok(queries.samples.has('createtableusers'))

      const select = queries.samples.get('select*fromfoowherea=?')

      t.equal(select.callCount, 2, 'should have correct callCount')
      t.equal(select.max, 800, 'max should be set')
      t.equal(select.min, 600, 'min should be set')
      t.equal(select.total, 1400, 'total should be set')
      t.equal(select.trace.duration, 800, 'trace should be set')

      const create = queries.samples.get('createtableusers')

      t.equal(create.callCount, 2, 'should have correct callCount')
      t.equal(create.max, 650, 'max should be set')
      t.equal(create.min, 500, 'min should be set')
      t.equal(create.total, 1150, 'total should be set')
      t.equal(create.trace.duration, 650, 'trace should be set')
      t.end()
    })
  })
})

function addQuery(queries, duration, url, query) {
  const transaction = new FakeTransaction(null, url)
  const segment = new FakeSegment(transaction, duration)

  queries.add(segment, 'mysql', query || 'select * from foo where a=2', FAKE_STACK)

  return segment
}

function verifySample(t, sample, count, segment) {
  t.equal(sample.callCount, count, 'should have correct callCount')
  t.ok(sample.max, 'max should be set')
  t.ok(sample.min, 'min should be set')
  t.ok(sample.sumOfSquares, 'sumOfSquares should be set')
  t.ok(sample.total, 'total should be set')
  t.ok(sample.totalExclusive, 'totalExclusive should be set')
  t.ok(sample.trace, 'trace should be set')
  verifyTrace(t, sample.trace, segment)
}

function verifyTrace(t, trace, segment) {
  t.equal(trace.duration, segment.getDurationInMillis(), 'should save duration')
  t.equal(trace.segment, segment, 'should hold onto segment')
  t.equal(trace.id, 374780417029088500, 'should have correct id')
  t.equal(trace.metric, segment.name, 'metric and segment name should match')
  t.equal(trace.normalized, 'select*fromfoowherea=?', 'should set normalized')
  t.equal(trace.obfuscated, 'select * from foo where a=?', 'should set obfuscated')
  t.equal(trace.query, 'select * from foo where a=2', 'should set query')
  t.equal(trace.trace, 'fake stack', 'should set trace')
}
