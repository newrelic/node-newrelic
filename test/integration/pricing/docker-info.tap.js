'use strict'

var a = require('async')
var test = require('tap').test
var fs = require('fs')
var parseDockerInfo = require('../../../lib/parse-dockerinfo')
var helper = require('../../lib/agent_helper')
var agent = helper.loadMockedAgent()
var path = require('path')


test('pricing docker info', function(t) {
  var testDirectory =
    path.resolve(__dirname, '../../lib/cross_agent_tests/docker_container_id/')

  var endExpectedMetrics = {}

  fs.readFile(testDirectory + '/cases.json', function readCasefile(err, data) {
    if (err) throw err
    var cases = JSON.parse(data)
    t.ok(cases.length > 0, 'should have tests to run')
    a.each(cases, function(dockerIdCase, cb) {
      testFile(
        path.join(testDirectory, dockerIdCase.filename),
        dockerIdCase.containerId,
        dockerIdCase.expectedMetrics,
        cb
      )
    }, function(err) {
      t.notOk(err, 'should not have an error')
      for (var expectedMetric in endExpectedMetrics) {
        var metric = agent.metrics.getOrCreateMetric(expectedMetric)
        t.equal(
          metric.callCount,
          endExpectedMetrics[expectedMetric],
          'should have correct call count'
        )
      }
      t.end()
    })
  })

  function testFile(file, expected, expectedMetrics, cb) {
    fs.readFile(file, function readTestInput(err, data) {
      if (err) throw err
      var info = parseDockerInfo(agent, data.toString())
      t.equal(info, expected, "should match id on " + file)
      if (expectedMetrics) {
        for (var metric in expectedMetrics) {
          if (endExpectedMetrics[metric]) {
            endExpectedMetrics[metric] += expectedMetrics[metric].callCount
          } else {
            endExpectedMetrics[metric] = expectedMetrics[metric].callCount
          }
        }
      }
      cb()
    })
  }
})
