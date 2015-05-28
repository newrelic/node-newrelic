'use strict'

var fs = require('fs')
var parseDockerInfo = require('../../../lib/parse-dockerinfo')
var helper = require('../../lib/agent_helper')
var assert = require('chai').assert
var agent = helper.loadMockedAgent()

var testDirectory = '../../lib/cross_agent_tests/docker_container_id/'

var endExpectedMetrics = {}

fs.readFile(testDirectory + 'cases.json', function readCasefile(err, data) {
  if (err) throw err
  var cases = JSON.parse(data)
  assert(cases.length > 0, 'There were no tests found to run')
  cases.forEach(function readDockerInfo(dockerIdCase) {
    testFile(testDirectory + dockerIdCase.filename, dockerIdCase.containerId,
        dockerIdCase.expectedMetrics)
  })
})

function testFile(file, expected, expectedMetrics) {
  fs.readFile(file, function readTestInput(err, data) {
    if (err) throw err
    var info = parseDockerInfo(agent, data.toString())
    assert.equal(info, expected, "Failed id match on " + file)
    if (expectedMetrics) {
      for (var expectedMetric in expectedMetrics) {
        if (endExpectedMetrics[expectedMetric]) {
          endExpectedMetrics[expectedMetric] += expectedMetrics[expectedMetric].callCount
        } else {
          endExpectedMetrics[expectedMetric] = expectedMetrics[expectedMetric].callCount
        }
      }
    }
  })
}

process.on('exit', function () {
  for (var expectedMetric in endExpectedMetrics) {
    var metric = agent.metrics.getOrCreateMetric(expectedMetric)
    assert.equal(metric.callCount, endExpectedMetrics[expectedMetric])
  }
})
