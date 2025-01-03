/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Config = require('../../../lib/config')
const QueryTraceAggregator = require('../../../lib/db/query-trace-aggregator')
const codec = require('../../../lib/util/codec')
const { FakeSegment, FakeTransaction } = require('../../lib/agent_helper')
const sinon = require('sinon')

const FAKE_STACK = 'Error\nfake stack'

test('Query Trace Aggregator', async (t) => {
  await t.test(
    'when no queries in payload, _toPayload should exec callback with null data',
    (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'off', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      let cbCalledWithNull = false

      const cb = (_, data) => {
        if (data === null) {
          cbCalledWithNull = true
        }
      }

      queries._toPayload(cb)

      assert.ok(cbCalledWithNull)
      end()
    }
  )

  await t.test('when slow_sql.enabled is false', async (t) => {
    await t.test(
      'should not record anything when transaction_tracer.record_sql === "off"',
      (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: false },
            transaction_tracer: { record_sql: 'off', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        const segment = addQuery(queries, 1000)
        assert.ok('size' in queries.samples)
        assert.equal(queries.samples.size, 0)
        assert.deepStrictEqual(segment.getAttributes(), {}, 'should not record sql in trace')
        end()
      }
    )

    await t.test('should treat unknown value in transaction_tracer.record_sql as off', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'something else', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      const segment = addQuery(queries, 1000)
      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 0)
      assert.deepStrictEqual(segment.getAttributes(), {}, 'should not record sql in trace')
      end()
    })

    await t.test('should record only in trace when record_sql === "obfuscated"', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      const segment = addQuery(queries, 1000)
      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 0)
      assert.deepStrictEqual(
        segment.getAttributes(),
        {
          backtrace: 'fake stack',
          sql_obfuscated: 'select * from foo where a=?'
        },
        'should record sql in trace'
      )
      end()
    })

    await t.test('should record only in trace when record_sql === "raw"', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      const segment = addQuery(queries, 1000)
      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 0)
      assert.deepStrictEqual(
        segment.getAttributes(),
        {
          backtrace: 'fake stack',
          sql: 'select * from foo where a=2'
        },
        'should record sql in trace'
      )
      end()
    })

    await t.test('should not record if below threshold', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: false },
          transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      const segment = addQuery(queries, 100)
      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 0)
      assert.deepStrictEqual(
        segment.getAttributes(),
        {
          sql: 'select * from foo where a=2'
        },
        'should record sql in trace'
      )
      end()
    })
  })

  await t.test('when slow_sql.enabled is true', async (t) => {
    await t.test(
      'should not record anything when transaction_tracer.record_sql === "off"',
      (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'off', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        const segment = addQuery(queries, 1000)
        assert.ok('size' in queries.samples)
        assert.equal(queries.samples.size, 0)
        assert.deepStrictEqual(segment.getAttributes(), {}, 'should not record sql in trace')
        end()
      }
    )

    await t.test('should treat unknown value in transaction_tracer.record_sql as off', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'something else', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      const segment = addQuery(queries, 1000)
      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 0)
      assert.deepStrictEqual(segment.getAttributes(), {}, 'should not record sql in trace')
      end()
    })

    await t.test('should record obfuscated trace when record_sql === "obfuscated"', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      const segment = addQuery(queries, 1000)
      assert.deepStrictEqual(
        segment.getAttributes(),
        {
          backtrace: 'fake stack',
          sql_obfuscated: 'select * from foo where a=?'
        },
        'should not record sql in trace'
      )

      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 1)
      assert.ok(queries.samples.has('select*fromfoowherea=?'))

      const sample = queries.samples.get('select*fromfoowherea=?')
      verifySample(sample, 1, segment)
      end()
    })

    await t.test('should record raw when record_sql === "raw"', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      const segment = addQuery(queries, 1000)
      assert.deepStrictEqual(
        segment.getAttributes(),
        {
          backtrace: 'fake stack',
          sql: 'select * from foo where a=2'
        },
        'should not record sql in trace'
      )

      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 1)
      assert.ok(queries.samples.has('select*fromfoowherea=?'))

      const sample = queries.samples.get('select*fromfoowherea=?')
      verifySample(sample, 1, segment)
      end()
    })

    await t.test('should not record if below threshold', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      const segment = addQuery(queries, 100)
      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 0)
      assert.deepStrictEqual(
        segment.getAttributes(),
        {
          sql: 'select * from foo where a=2'
        },
        'should record sql in trace'
      )
      end()
    })
  })

  await t.test('prepareJSON', async (t) => {
    await t.test('webTransaction when record_sql is "raw"', async (t) => {
      t.beforeEach((ctx) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        ctx.nr = {}
        ctx.nr.queries = new QueryTraceAggregator(opts, {}, harvester)
      })

      await t.test('and `simple_compression` is `false`', async (t) => {
        t.beforeEach((ctx) => {
          ctx.nr.queries.config.simple_compression = false
        })

        await t.test('should compress the query parameters', (t, end) => {
          const { queries } = t.nr
          addQuery(queries, 600, '/abc')

          queries.prepareJSON(function preparedJSON(err, data) {
            assert.ifError(err)
            const sample = data[0]

            codec.decode(sample[9], function decoded(error, params) {
              assert.equal(error, null, 'should not error')

              const keys = Object.keys(params)

              assert.deepStrictEqual(keys, ['backtrace'])
              assert.deepStrictEqual(params.backtrace, 'fake stack', 'trace should match')
              end()
            })
          })
        })
      })

      await t.test('and `simple_compression` is `true`', async (t) => {
        t.beforeEach((ctx) => {
          ctx.nr.queries.config.simple_compression = true
        })

        await t.test('should not compress the query parameters', (t, end) => {
          const { queries } = t.nr
          addQuery(queries, 600, '/abc')

          queries.prepareJSON(function preparedJSON(err, data) {
            assert.ifError(err)
            const sample = data[0]
            const params = sample[9]
            const keys = Object.keys(params)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(params.backtrace, 'fake stack', 'trace should match')
            end()
          })
        })
      })

      await t.test('should record work when empty', (t, end) => {
        const { queries } = t.nr
        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.deepStrictEqual(data, [], 'should return empty array')
          end()
        })
      })

      await t.test('should record work with a single query', (t, end) => {
        const { queries } = t.nr
        addQuery(queries, 600, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 600, 'should match total')
          assert.equal(sample[7], 600, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            end()
          })
        })
      })

      await t.test('should record work with a multiple similar queries', (t, end) => {
        const { queries } = t.nr
        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 2, 'should have 1 call')
          assert.equal(sample[6], 1150, 'should match total')
          assert.equal(sample[7], 550, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            end()
          })
        })
      })

      await t.test('should record work with a multiple unique queries', (t, end) => {
        const { queries } = t.nr
        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc', 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 2, 'should be 2 sample queries')

          data.sort(function compareTotalTimeDesc(lhs, rhs) {
            const rhTotal = rhs[6]
            const lhTotal = lhs[6]

            return rhTotal - lhTotal
          })

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 600, 'should match total')
          assert.equal(sample[7], 600, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            nextSample()
          })

          function nextSample() {
            const sample2 = data[1]

            assert.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            assert.equal(sample2[1], '/abc', 'should match transaction url')
            assert.equal(sample2[2], 487602586913804700, 'should match query id')
            assert.equal(sample2[3], 'drop table users', 'should match raw query')
            assert.equal(sample2[4], 'FakeSegment', 'should match segment name')
            assert.equal(sample2[5], 1, 'should have 1 call')
            assert.equal(sample2[6], 550, 'should match total')
            assert.equal(sample2[7], 550, 'should match min')
            assert.equal(sample2[8], 550, 'should match max')

            codec.decode(sample2[9], function decoded(error, result) {
              assert.equal(error, null, 'should not error')

              const keys = Object.keys(result)

              assert.deepStrictEqual(keys, ['backtrace'])
              assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
              end()
            })
          }
        })
      })
    })

    await t.test('webTransaction when record_sql is "obfuscated"', async (t) => {
      await t.test('should record work when empty', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.deepStrictEqual(data, [], 'should return empty array')
          end()
        })
      })

      await t.test('should record work with a single query', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        addQuery(queries, 600, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 600, 'should match total')
          assert.equal(sample[7], 600, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            end()
          })
        })
      })

      await t.test('should record work with a multiple similar queries', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 2, 'should have 1 call')
          assert.equal(sample[6], 1150, 'should match total')
          assert.equal(sample[7], 550, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            end()
          })
        })
      })

      await t.test('should record work with a multiple unique queries', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc', 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 2, 'should be 1 sample query')

          data.sort(function compareTotalTimeDesc(lhs, rhs) {
            const rhTotal = rhs[6]
            const lhTotal = lhs[6]

            return rhTotal - lhTotal
          })

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 600, 'should match total')
          assert.equal(sample[7], 600, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')

            const sample2 = data[1]
            assert.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            assert.equal(sample2[1], '/abc', 'should match transaction url')
            assert.equal(sample2[2], 487602586913804700, 'should match query id')
            assert.equal(sample2[3], 'drop table users', 'should match raw query')
            assert.equal(sample2[4], 'FakeSegment', 'should match segment name')
            assert.equal(sample2[5], 1, 'should have 1 call')
            assert.equal(sample2[6], 550, 'should match total')
            assert.equal(sample2[7], 550, 'should match min')
            assert.equal(sample2[8], 550, 'should match max')

            codec.decode(sample2[9], function (error, nextResult) {
              assert.equal(error, null, 'should not error')

              const nextKey = Object.keys(nextResult)

              assert.deepStrictEqual(nextKey, ['backtrace'])
              assert.deepStrictEqual(nextResult.backtrace, 'fake stack', 'trace should match')
              end()
            })
          })
        })
      })
    })

    await t.test('backgroundTransaction when record_sql is "raw"', async (t) => {
      await t.test('should record work when empty', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.deepStrictEqual(data, [], 'should return empty array')
          end()
        })
      })

      await t.test('should record work with a single query', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        addQuery(queries, 600, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 600, 'should match total')
          assert.equal(sample[7], 600, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            end()
          })
        })
      })

      await t.test('should record work with a multiple similar queries', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        addQuery(queries, 600, null)
        addQuery(queries, 550, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 2, 'should have 1 call')
          assert.equal(sample[6], 1150, 'should match total')
          assert.equal(sample[7], 550, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            end()
          })
        })
      })

      await t.test('should record work with a multiple unique queries', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'raw', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        addQuery(queries, 600, null)
        addQuery(queries, 550, null, 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 2, 'should be 1 sample query')

          data.sort(function compareTotalTimeDesc(lhs, rhs) {
            const rhTotal = rhs[6]
            const lhTotal = lhs[6]

            return rhTotal - lhTotal
          })

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 600, 'should match total')
          assert.equal(sample[7], 600, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            nextSample()
          })

          function nextSample() {
            const sample2 = data[1]
            assert.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            assert.equal(sample2[1], '<unknown>', 'should match transaction url')
            assert.equal(sample2[2], 487602586913804700, 'should match query id')
            assert.equal(sample2[3], 'drop table users', 'should match raw query')
            assert.equal(sample2[4], 'FakeSegment', 'should match segment name')
            assert.equal(sample2[5], 1, 'should have 1 call')
            assert.equal(sample2[6], 550, 'should match total')
            assert.equal(sample2[7], 550, 'should match min')
            assert.equal(sample2[8], 550, 'should match max')

            codec.decode(sample2[9], function decoded(error, result) {
              assert.equal(error, null, 'should not error')

              const keys = Object.keys(result)

              assert.deepStrictEqual(keys, ['backtrace'])
              assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
              end()
            })
          }
        })
      })
    })

    await t.test('background when record_sql is "obfuscated"', async (t) => {
      await t.test('should record work when empty', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.deepStrictEqual(data, [], 'should return empty array')
          end()
        })
      })

      await t.test('should record work with a single query', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        addQuery(queries, 600, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 600, 'should match total')
          assert.equal(sample[7], 600, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            end()
          })
        })
      })

      await t.test('should record work with a multiple similar queries', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        addQuery(queries, 600, null)
        addQuery(queries, 550, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 2, 'should have 1 call')
          assert.equal(sample[6], 1150, 'should match total')
          assert.equal(sample[7], 550, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')
            end()
          })
        })
      })

      await t.test('should record work with a multiple unique queries', (t, end) => {
        const opts = {
          config: new Config({
            slow_sql: { enabled: true },
            transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
          }),
          method: 'sql_trace_data'
        }
        const harvester = { add: sinon.stub() }
        const queries = new QueryTraceAggregator(opts, {}, harvester)

        addQuery(queries, 600, null)
        addQuery(queries, 550, null, 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 2, 'should be 1 sample query')

          data.sort(function compareTotalTimeDesc(lhs, rhs) {
            const rhTotal = rhs[6]
            const lhTotal = lhs[6]

            return rhTotal - lhTotal
          })

          const sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 374780417029088500, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 600, 'should match total')
          assert.equal(sample[7], 600, 'should match min')
          assert.equal(sample[8], 600, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            const keys = Object.keys(result)

            assert.deepStrictEqual(keys, ['backtrace'])
            assert.deepStrictEqual(result.backtrace, 'fake stack', 'trace should match')

            const sample2 = data[1]
            assert.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            assert.equal(sample2[1], '<unknown>', 'should match transaction url')
            assert.equal(sample2[2], 487602586913804700, 'should match query id')
            assert.equal(sample2[3], 'drop table users', 'should match raw query')
            assert.equal(sample2[4], 'FakeSegment', 'should match segment name')
            assert.equal(sample2[5], 1, 'should have 1 call')
            assert.equal(sample2[6], 550, 'should match total')
            assert.equal(sample2[7], 550, 'should match min')
            assert.equal(sample2[8], 550, 'should match max')

            codec.decode(sample2[9], function (error, nextResult) {
              assert.equal(error, null, 'should not error')

              const nextKeys = Object.keys(nextResult)

              assert.deepStrictEqual(nextKeys, ['backtrace'])
              assert.deepStrictEqual(nextResult.backtrace, 'fake stack', 'trace should match')
              end()
            })
          })
        })
      })
    })
  })

  await t.test('limiting to n slowest', async (t) => {
    await t.test('should limit to this.config.max_samples', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true, max_samples: 2 },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      addQuery(queries, 600, null)
      addQuery(queries, 550, null, 'create table users')

      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 2)
      assert.ok(queries.samples.has('select*fromfoowherea=?'))
      assert.ok(queries.samples.has('createtableusers'))

      addQuery(queries, 650, null, 'drop table users')

      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 2)
      assert.ok(queries.samples.has('select*fromfoowherea=?'))
      assert.ok(queries.samples.has('droptableusers'))
      end()
    })
  })

  await t.test('merging query tracers', async (t) => {
    await t.test('should merge queries correctly', (t, end) => {
      const opts = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const harvester = { add: sinon.stub() }
      const queries = new QueryTraceAggregator(opts, {}, harvester)

      const opts2 = {
        config: new Config({
          slow_sql: { enabled: true },
          transaction_tracer: { record_sql: 'obfuscated', explain_threshold: 500 }
        }),
        method: 'sql_trace_data'
      }
      const queries2 = new QueryTraceAggregator(opts2, {}, harvester)

      addQuery(queries, 600, null)
      addQuery(queries, 650, null, 'create table users')
      addQuery(queries2, 800, null)
      addQuery(queries2, 500, null, 'create table users')

      queries._merge(queries2.samples)

      assert.ok('size' in queries.samples)
      assert.equal(queries.samples.size, 2)
      assert.ok(queries.samples.has('select*fromfoowherea=?'))
      assert.ok(queries.samples.has('createtableusers'))

      const select = queries.samples.get('select*fromfoowherea=?')

      assert.equal(select.callCount, 2, 'should have correct callCount')
      assert.equal(select.max, 800, 'max should be set')
      assert.equal(select.min, 600, 'min should be set')
      assert.equal(select.total, 1400, 'total should be set')
      assert.equal(select.trace.duration, 800, 'trace should be set')

      const create = queries.samples.get('createtableusers')

      assert.equal(create.callCount, 2, 'should have correct callCount')
      assert.equal(create.max, 650, 'max should be set')
      assert.equal(create.min, 500, 'min should be set')
      assert.equal(create.total, 1150, 'total should be set')
      assert.equal(create.trace.duration, 650, 'trace should be set')
      end()
    })
  })
})

function addQuery(queries, duration, url, query) {
  const transaction = new FakeTransaction(null, url)
  const segment = new FakeSegment(transaction, duration)

  queries.add(segment, 'mysql', query || 'select * from foo where a=2', FAKE_STACK)

  return segment
}

function verifySample(sample, count, segment) {
  assert.equal(sample.callCount, count, 'should have correct callCount')
  assert.ok(sample.max, 'max should be set')
  assert.ok(sample.min, 'min should be set')
  assert.ok(sample.sumOfSquares, 'sumOfSquares should be set')
  assert.ok(sample.total, 'total should be set')
  assert.ok(sample.totalExclusive, 'totalExclusive should be set')
  assert.ok(sample.trace, 'trace should be set')
  verifyTrace(sample.trace, segment)
}

function verifyTrace(trace, segment) {
  assert.equal(trace.duration, segment.getDurationInMillis(), 'should save duration')
  assert.equal(trace.segment, segment, 'should hold onto segment')
  assert.equal(trace.id, 374780417029088500, 'should have correct id')
  assert.equal(trace.metric, segment.name, 'metric and segment name should match')
  assert.equal(trace.normalized, 'select*fromfoowherea=?', 'should set normalized')
  assert.equal(trace.obfuscated, 'select * from foo where a=?', 'should set obfuscated')
  assert.equal(trace.query, 'select * from foo where a=2', 'should set query')
  assert.equal(trace.trace, 'fake stack', 'should set trace')
}
