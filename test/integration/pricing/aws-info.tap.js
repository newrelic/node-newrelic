'use strict'

var nock = require('nock')
var fs = require('fs')
var helper = require('../../lib/agent_helper')
var getAWSInfo = require('../../../lib/aws-info')
var assert = require('chai').assert
var agent = helper.loadMockedAgent()
var http = require('http')
var _httpGet = http.get
var host

var expectedMetrics = {}

var testDirectory = '../../lib/cross_agent_tests/'

nock.disableNetConnect()

fs.readFile(testDirectory + 'aws.json', function readCasefile(err, data) {
  if (err) {
    throw err
  }
  var cases = JSON.parse(data)
  assert(cases.length > 0, 'There were no tests found to run')
  testCases(cases)
})


function testCases(cases) {
  if (cases.length === 0) return
  var AWSCase = cases.pop()
  var redirection
  var uris = AWSCase.uris
  var metrics = AWSCase.expected_metrics
  var timeoutUrl

  function timeoutMock(timeoutUrl) {
    var timeoutCallback
    var res = {
      setTimeout: function (timeout, fn) {
        timeoutCallback = fn
      },
      on: function (msg, callback) {
        return
      }
    }
    return function wrappedGet(options, callback) {
      setTimeout(function makeRequest() {
        if (timeoutUrl === options) return timeoutCallback()

        _httpGet(options, callback)
      }, 0)
      return res
    }
  }

  for (var url in uris) {
    var responseData = uris[url]
    var hostUrl = url.split('/').slice(0, 3).join('/')
    var path = '/' + url.split('/').slice(3).join('/')
    host = host || nock(hostUrl)

    if (responseData.timeout) timeoutUrl = hostUrl + path

    redirection = host.get(path)

    redirection.reply(200, responseData.response || '')
  }

  http.get = timeoutMock(timeoutUrl)

  getAWSInfo(agent, function testAWSInfo(info) {
    var expected = AWSCase.expected_vendors_hash && AWSCase.expected_vendors_hash.aws
    assert.deepEqual(info, expected, 'Failed on ' + AWSCase.testname)
    if (metrics) {
      for (var metric in metrics) {
        var callCount = metrics[metric].call_count
        if (expectedMetrics[metric]) expectedMetrics[metric].callCount += callCount
        else expectedMetrics[metric] = {callCount: 1}
      }
    }
    if (!info) {
      nock.cleanAll()
      host = nock(hostUrl)
      testCases(cases)
    } else {
      checkCaching(function cacheCheck() {
        nock.cleanAll()
        host = nock(hostUrl)
        testCases(cases)
      })
    }
  })
}

function checkMetrics() {
  for (var expectedMetric in expectedMetrics) {
    var metric = agent.metrics.getOrCreateMetric(expectedMetric)
    assert.equal(expectedMetrics[expectedMetric].callCount, metric.callCount)
  }
}

function checkCaching(callback) {
  // There are no mocks currently active, but the module should cache the
  // results.
  assert(host.isDone(), 'Expected no mocked endpoints')
  getAWSInfo(agent, function getCachedInfo(info) {
    assert(info, 'Expected cached data back')
    callback()
  })
}

function finalStep() {
  checkMetrics()
  nock.enableNetConnect()
  helper.unloadAgent(agent)
}

process.on('exit', finalStep)
