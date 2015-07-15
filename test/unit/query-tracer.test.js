'use strict'

var assert = require('chai').assert
var Tracer = require('../../lib/db/tracer')
var codec = require('../../lib/util/codec')

var FAKE_STACK = 'Error\nfake stack'

describe('Query Tracer', function testQueryTracer() {
  describe('when slow_sql.enabled is false', function testDisabled() {
    it('should not record anything when transaction_tracer.record_sql === "off"', testOff)
    it('should treat unknown value in transaction_tracer.record_sql as off', testUnknown)
    it('should record only in trace when record_sql === "obfuscated"', testObfuscated)
    it('should record only in trace when record_sql === "raw"', testRaw)
    it('should not record if below threshold', testThreshold)

    function testOff() {
      var queries = new Tracer({
        slow_sql: {enabled: false},
        transaction_tracer: {record_sql: 'off', explain_threshold: 500}
      })

      var segment = addQuery(queries, 1000)
      assert.deepEqual(queries.samples, {}, 'should not collect sample')
      assert.deepEqual(segment.parameters, {}, 'should not record sql in trace')
    }

    function testUnknown() {
      var queries = new Tracer({
        slow_sql: {enabled: false},
        transaction_tracer: {record_sql: 'something else', explain_threshold: 500}
      })

      var segment = addQuery(queries, 1000)
      assert.deepEqual(queries.samples, {}, 'should not collect sample')
      assert.deepEqual(segment.parameters, {}, 'should not record sql in trace')
    }

    function testObfuscated() {
      var queries = new Tracer({
        slow_sql: {enabled: false},
        transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
      })

      var segment = addQuery(queries, 1000)
      assert.deepEqual(queries.samples, {}, 'should not collect sample')
      assert.deepEqual(segment.parameters, {
        backtrace: 'fake stack',
        sql_obfuscated: 'select * from foo where a=?'
      }, 'should not record sql in trace')
    }

    function testRaw() {
      var queries = new Tracer({
        slow_sql: {enabled: false},
        transaction_tracer: {record_sql: 'raw', explain_threshold: 500}
      })

      var segment = addQuery(queries, 1000)
      assert.deepEqual(queries.samples, {}, 'should not collect sample')
      assert.deepEqual(segment.parameters, {
        backtrace: 'fake stack',
        sql: 'select * from foo where a=2'
      }, 'should not record sql in trace')
    }

    function testThreshold() {
      var queries = new Tracer({
        slow_sql: {enabled: false},
        transaction_tracer: {record_sql: 'raw', explain_threshold: 500}
      })

      var segment = addQuery(queries, 100)
      assert.deepEqual(queries.samples, {}, 'should not collect sample')
      assert.deepEqual(segment.parameters, {}, 'should not record sql in trace')
    }
  })

  describe('when slow_sql.enabled is true', function testEnabled() {
    it('should not record anything when transaction_tracer.record_sql === "off"', testOff)
    it('should treat unknown value in transaction_tracer.record_sql as off', testUnknown)
    it('should record obfuscated trace when record_sql === "obfuscated"', testObfuscated)
    it('should record raw when record_sql === "raw"', testRaw)
    it('should not record if below threshold', testThreshold)

    function testOff() {
      var queries = new Tracer({
        slow_sql: {enabled: true},
        transaction_tracer: {record_sql: 'off', explain_threshold: 500}
      })

      var segment = addQuery(queries, 1000)
      assert.deepEqual(queries.samples, {}, 'should not collect sample')
      assert.deepEqual(segment.parameters, {}, 'should not record sql in trace')
    }

    function testUnknown() {
      var queries = new Tracer({
        slow_sql: {enabled: true},
        transaction_tracer: {record_sql: 'something else', explain_threshold: 500}
      })

      var segment = addQuery(queries, 1000)
      assert.deepEqual(queries.samples, {}, 'should not collect sample')
      assert.deepEqual(segment.parameters, {}, 'should not record sql in trace')
    }

    function testObfuscated() {
      var queries = new Tracer({
        slow_sql: {enabled: true},
        transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
      })

      var segment = addQuery(queries, 1000)
      assert.deepEqual(segment.parameters, {
        backtrace: 'fake stack',
        sql_obfuscated: 'select * from foo where a=?'
      }, 'should not record sql in trace')

      var keys = Object.keys(queries.samples)

      assert.deepEqual(keys, ['select*fromfoowherea=?'])

      var sample = queries.samples[keys[0]]
      verifySample(sample, 1, segment)
    }

    function testRaw() {
      var queries = new Tracer({
        slow_sql: {enabled: true},
        transaction_tracer: {record_sql: 'raw', explain_threshold: 500}
      })

      var segment = addQuery(queries, 1000)
      assert.deepEqual(segment.parameters, {
        backtrace: 'fake stack',
        sql: 'select * from foo where a=2'
      }, 'should not record sql in trace')

      var keys = Object.keys(queries.samples)

      assert.deepEqual(keys, ['select*fromfoowherea=?'])

      var sample = queries.samples[keys[0]]
      verifySample(sample, 1, segment)
    }

    function testThreshold() {
      var queries = new Tracer({
        slow_sql: {enabled: true},
        transaction_tracer: {record_sql: 'raw', explain_threshold: 500}
      })

      var segment = addQuery(queries, 100)
      assert.deepEqual(queries.samples, {}, 'should not collect sample')
      assert.deepEqual(segment.parameters, {}, 'should not record sql in trace')
    }
  })

  describe('prepareJSON', function testPrepareJSON() {
    describe('webTransaction when record_sql is "raw"', function testWebTransaction() {

      var queries

      beforeEach(function () {
        queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'raw', explain_threshold: 500}
        })
      })

      it('should record work when empty', function testRaw(done) {
        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.deepEqual(data, [], 'should return empty array')
          done()
        })
      })

      it('should record work with a single query', function testRaw(done) {
        addQuery(queries, 600, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 0.6, 'should match total')
          assert.equal(sample[7], 0.6, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            done()
          })
        })
      })

      it('should record work with a multiple similar queries', function testRaw(done) {
        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 2, 'should have 1 call')
          assert.equal(sample[6], 1.15, 'should match total')
          assert.equal(sample[7], 0.55, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            done()
          })
        })
      })

      it('should record work with a multiple unique queries', function testRaw(done) {
        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc', 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 2, 'should be 2 sample queries')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 0.6, 'should match total')
          assert.equal(sample[7], 0.6, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            nextSample()
          })

          function nextSample() {
            var sample2 = data[1]
            assert.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            assert.equal(sample2[1], '/abc', 'should match transaction url')
            assert.equal(sample2[2], 21676, 'should match query id')
            assert.equal(sample2[3], 'drop table users', 'should match raw query')
            assert.equal(sample2[4], 'FakeSegment', 'should match segment name')
            assert.equal(sample2[5], 1, 'should have 1 call')
            assert.equal(sample2[6], 0.55, 'should match total')
            assert.equal(sample2[7], 0.55, 'should match min')
            assert.equal(sample2[8], 0.55, 'should match max')

            codec.decode(sample2[9], function decoded(error, result) {
              assert.equal(error, null, 'should not error')

              var keys = Object.keys(result)

              assert.deepEqual(keys, ['backtrace'])
              assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
              done()
            })
          }
        })
      })
    })

    describe('webTransaction when record_sql is "obfuscated"', function testWebTransaction() {
      it('should record work when empty', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
        })

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.deepEqual(data, [], 'should return empty array')
          done()
        })
      })

      it('should record work with a single query', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
        })

        addQuery(queries, 600, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 0.6, 'should match total')
          assert.equal(sample[7], 0.6, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            done()
          })
        })
      })

      it('should record work with a multiple similar queries', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
        })

        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 2, 'should have 1 call')
          assert.equal(sample[6], 1.15, 'should match total')
          assert.equal(sample[7], 0.55, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            done()
          })
        })
      })

      it('should record work with a multiple unique queries', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
        })

        addQuery(queries, 600, '/abc')
        addQuery(queries, 550, '/abc', 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 2, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '/abc', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 0.6, 'should match total')
          assert.equal(sample[7], 0.6, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            nextSample()
          })

          function nextSample() {
            var sample2 = data[1]
            assert.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            assert.equal(sample2[1], '/abc', 'should match transaction url')
            assert.equal(sample2[2], 21676, 'should match query id')
            assert.equal(sample2[3], 'drop table users', 'should match raw query')
            assert.equal(sample2[4], 'FakeSegment', 'should match segment name')
            assert.equal(sample2[5], 1, 'should have 1 call')
            assert.equal(sample2[6], 0.55, 'should match total')
            assert.equal(sample2[7], 0.55, 'should match min')
            assert.equal(sample2[8], 0.55, 'should match max')

            codec.decode(sample2[9], function decoded(error, result) {
              assert.equal(error, null, 'should not error')

              var keys = Object.keys(result)

              assert.deepEqual(keys, ['backtrace'])
              assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
              done()
            })
          }
        })
      })
    })

    describe('backgroundTransaction when record_sql is "raw"', function testBackground() {
      it('should record work when empty', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'raw', explain_threshold: 500}
        })

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.deepEqual(data, [], 'should return empty array')
          done()
        })
      })

      it('should record work with a single query', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'raw', explain_threshold: 500}
        })

        addQuery(queries, 600, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 0.6, 'should match total')
          assert.equal(sample[7], 0.6, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            done()
          })
        })
      })

      it('should record work with a multiple similar queries', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'raw', explain_threshold: 500}
        })

        addQuery(queries, 600, null)
        addQuery(queries, 550, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 2, 'should have 1 call')
          assert.equal(sample[6], 1.15, 'should match total')
          assert.equal(sample[7], 0.55, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            done()
          })
        })
      })

      it('should record work with a multiple unique queries', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'raw', explain_threshold: 500}
        })

        addQuery(queries, 600, null)
        addQuery(queries, 550, null, 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 2, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=2', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 0.6, 'should match total')
          assert.equal(sample[7], 0.6, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            nextSample()
          })

          function nextSample() {
            var sample2 = data[1]
            assert.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            assert.equal(sample2[1], '<unknown>', 'should match transaction url')
            assert.equal(sample2[2], 21676, 'should match query id')
            assert.equal(sample2[3], 'drop table users', 'should match raw query')
            assert.equal(sample2[4], 'FakeSegment', 'should match segment name')
            assert.equal(sample2[5], 1, 'should have 1 call')
            assert.equal(sample2[6], 0.55, 'should match total')
            assert.equal(sample2[7], 0.55, 'should match min')
            assert.equal(sample2[8], 0.55, 'should match max')

            codec.decode(sample2[9], function decoded(error, result) {
              assert.equal(error, null, 'should not error')

              var keys = Object.keys(result)

              assert.deepEqual(keys, ['backtrace'])
              assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
              done()
            })
          }
        })
      })
    })

    describe('background when record_sql is "obfuscated"', function testBackground() {
      it('should record work when empty', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
        })

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.deepEqual(data, [], 'should return empty array')
          done()
        })
      })

      it('should record work with a single query', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
        })

        addQuery(queries, 600, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 0.6, 'should match total')
          assert.equal(sample[7], 0.6, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            done()
          })
        })
      })

      it('should record work with a multiple similar queries', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
        })

        addQuery(queries, 600, null)
        addQuery(queries, 550, null)

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 1, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 2, 'should have 1 call')
          assert.equal(sample[6], 1.15, 'should match total')
          assert.equal(sample[7], 0.55, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            done()
          })
        })
      })

      it('should record work with a multiple unique queries', function testRaw(done) {
        var queries = new Tracer({
          slow_sql: {enabled: true},
          transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
        })

        addQuery(queries, 600, null)
        addQuery(queries, 550, null, 'drop table users')

        queries.prepareJSON(function preparedJSON(err, data) {
          assert.equal(err, null, 'should not error')
          assert.equal(data.length, 2, 'should be 1 sample query')

          data.sort(function (lhs, rhs) {
            return rhs[2] - lhs[2]
          })

          var sample = data[0]
          assert.equal(sample[0], 'FakeTransaction', 'should match transaction name')
          assert.equal(sample[1], '<unknown>', 'should match transaction url')
          assert.equal(sample[2], 35940, 'should match query id')
          assert.equal(sample[3], 'select * from foo where a=?', 'should match raw query')
          assert.equal(sample[4], 'FakeSegment', 'should match segment name')
          assert.equal(sample[5], 1, 'should have 1 call')
          assert.equal(sample[6], 0.6, 'should match total')
          assert.equal(sample[7], 0.6, 'should match min')
          assert.equal(sample[8], 0.6, 'should match max')

          codec.decode(sample[9], function decoded(error, result) {
            assert.equal(error, null, 'should not error')

            var keys = Object.keys(result)

            assert.deepEqual(keys, ['backtrace'])
            assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
            nextSample()
          })

          function nextSample() {
            var sample2 = data[1]
            assert.equal(sample2[0], 'FakeTransaction', 'should match transaction name')
            assert.equal(sample2[1], '<unknown>', 'should match transaction url')
            assert.equal(sample2[2], 21676, 'should match query id')
            assert.equal(sample2[3], 'drop table users', 'should match raw query')
            assert.equal(sample2[4], 'FakeSegment', 'should match segment name')
            assert.equal(sample2[5], 1, 'should have 1 call')
            assert.equal(sample2[6], 0.55, 'should match total')
            assert.equal(sample2[7], 0.55, 'should match min')
            assert.equal(sample2[8], 0.55, 'should match max')

            codec.decode(sample2[9], function decoded(error, result) {
              assert.equal(error, null, 'should not error')

              var keys = Object.keys(result)

              assert.deepEqual(keys, ['backtrace'])
              assert.deepEqual(result.backtrace, 'fake stack', 'trace should match')
              done()
            })
          }
        })
      })
    })
  })

  describe('limiting to n slowest', function testRemoveShortest() {
    it('should limit to this.config.max_samples', function testMaxSamples() {
      var queries = new Tracer({
        slow_sql: {enabled: true, max_samples: 2},
        transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
      })

      addQuery(queries, 600, null)
      addQuery(queries, 550, null, 'create table users')

      assert.deepEqual(
        Object.keys(queries.samples),
        ['select*fromfoowherea=?', 'createtableusers']
      )

      addQuery(queries, 650, null, 'drop table users')

      assert.deepEqual(
        Object.keys(queries.samples),
        ['select*fromfoowherea=?', 'droptableusers']
      )
    })
  })

  describe('merging query tracers', function testMerging() {
    it('should merge queries correctly', function testMerge() {
      var queries = new Tracer({
        slow_sql: {enabled: true},
        transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
      })

      var queries2 = new Tracer({
        slow_sql: {enabled: true},
        transaction_tracer: {record_sql: 'obfuscated', explain_threshold: 500}
      })

      addQuery(queries, 600, null)
      addQuery(queries, 650, null, 'create table users')
      addQuery(queries2, 800, null)
      addQuery(queries2, 500, null, 'create table users')

      queries.merge(queries2)

      var keys = Object.keys(queries.samples)

      assert.deepEqual(keys, ['select*fromfoowherea=?', 'createtableusers'])

      var select = queries.samples['select*fromfoowherea=?']

      assert.equal(select.callCount, 2, 'should have correct callCount')
      assert.equal(select.max, 0.8, 'max should be set')
      assert.equal(select.min, 0.6, 'min should be set')
      assert.equal(select.total, 1.4, 'total should be set')
      assert.equal(select.trace.duration, 800, 'trace should be set')

      var create = queries.samples.createtableusers

      assert.equal(create.callCount, 2, 'should have correct callCount')
      assert.equal(create.max, 0.65, 'max should be set')
      assert.equal(create.min, 0.5, 'min should be set')
      assert.equal(create.total, 1.15, 'total should be set')
      assert.equal(create.trace.duration, 650, 'trace should be set')
    })
  })
})

function addQuery(queries, duration, url, query) {
  var transaction = new FakeTransaction(url)
  var segment = new FakeSegment(transaction, duration)

  queries.addQuery(segment, 'mysql', query || 'select * from foo where a=2', {
    stack: FAKE_STACK
  })

  return segment
}

function FakeTransaction(url) {
  this.url = url || null
  this.name = 'FakeTransaction'
}

function FakeSegment(transaction, duration, name) {
  this.transaction = transaction
  this.parameters = {}
  this.name = name || 'FakeSegment'
  this.getDurationInMillis = function getDurationInMillis() {
    return duration
  }
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
  assert.equal(trace.id, 35940, 'should have correct id')
  assert.equal(trace.metric, segment.name, 'metric and segment name should match')
  assert.equal(trace.normalized, 'select*fromfoowherea=?', 'should set normalized')
  assert.equal(trace.obfuscated, 'select * from foo where a=?', 'should set obfuscated')
  assert.equal(trace.query, 'select * from foo where a=2', 'should set query')
  assert.equal(trace.trace, 'fake stack', 'should set trace')
}
