'use strict'

var test = require('tap').test
var ruleTests = require('../../lib/cross_agent_tests/rules')
var Config = require('../../../lib/config')
var Normalizer = require('../../../lib/metrics/normalizer')

test('metric normalization', function(t) {
  t.plan(1)

  t.test('cross agent tests', function(t) {
    t.plan(ruleTests.length)
    var config = new Config({})

    ruleTests.forEach(function(rulesTest) {
      t.test(rulesTest.testname, function(t) {
        t.plan(rulesTest.tests.length * 2)

        var normalizer = new Normalizer(config, 'Url')
        normalizer.load(rulesTest.rules)

        rulesTest.tests.forEach(function(io) {
          var normalized = normalizer.normalize(io.input)

          if (io.expected === null) {
            t.pass('ignored, not checking name')
            t.ok(normalized.ignore, 'should ignore ' + io.input)
          } else {
            t.equal(
              normalized.value,
              io.expected,
              'should normalize ' + io.input + ' to ' + io.expected
            )
            t.notOk(normalized.ignore, 'should not ignore ' + io.input)
          }
        })
      })
    })
  })
})
