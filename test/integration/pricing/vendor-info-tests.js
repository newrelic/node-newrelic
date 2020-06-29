/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var path = require('path')
var nock = require('nock')
var fs = require('fs')
var helper = require('../../lib/agent_helper')
var http = require('http')
var _httpGet = http.get


module.exports = function(t, vendor) {
  var testFile = path.resolve(
    __dirname,
    '../../lib/cross_agent_tests/utilization_vendor_specific',
    vendor + '.json'
  )
  var getInfo = require('../../../lib/utilization/' + vendor + '-info')

  nock.disableNetConnect()
  t.tearDown(function() {
    nock.enableNetConnect()
  })

  fs.readFile(testFile, function(err, data) {
    if (!t.error(err, 'should not error loading tests')) {
      t.fail('Could not load tests!')
      t.end()
      return
    }

    var cases = JSON.parse(data)

    t.autoend()
    t.ok(cases.length > 0, 'should have tests to run')

    for (var i = 0; i < cases.length; ++i) {
      t.test(cases[i].testname, makeTest(cases[i], vendor, getInfo))
    }
  })
}

function makeTest(testCase, vendor, getInfo) {
  var agent = null
  return function(t) {
    agent = helper.loadMockedAgent()
    t.tearDown(function() {
      helper.unloadAgent(agent)
      getInfo.clearCache()
      nock.cleanAll()
    })

    var redirection = null
    var uris = Object.keys(testCase.uri)
    var timeoutUrl = null

    function timeoutMock(urlToTimeout) {
      var timeoutCallback
      let onErrorCallback = null

      var res = {
        setTimeout: function(timeout, fn) {
          timeoutCallback = fn
        },
        on: function(event, cb) {
          if (event === 'error') {
            onErrorCallback = cb
          }
        },
        abort: () => {
          // not particularly accurate invoking sync
          // but trying to keep parity.
          const error = new Error('ECONNRESET')
          error.code = 'ECONNRESET'
          onErrorCallback(error)
        }
      }
      return function wrappedGet(options, callback) {
        setTimeout(function makeRequest() {
          if (urlToTimeout === formatUrl(options)) {
            return timeoutCallback()
          }

          _httpGet(options, callback)
        }, 0)
        return res
      }
    }

    var host = null
    for (var i = 0; i < uris.length; ++i) {
      var uri = uris[i]
      var responseData = testCase.uri[uri]
      var hostUrl = uri.split('/').slice(0, 3).join('/')
      var endpoint = '/' + uri.split('/').slice(3).join('/')
      host = host || nock(hostUrl)

      if (responseData.timeout) {
        timeoutUrl = hostUrl + endpoint
      }

      redirection = host.get(endpoint)
      redirection.reply(200, JSON.stringify(responseData.response || ''))
    }

    http.get = timeoutMock(timeoutUrl)

    getInfo(agent, function(err, info) {
      if (testCase.expected_vendors_hash) {
        var expected = testCase.expected_vendors_hash[vendor]
        t.error(err, 'should not error getting data')
        t.same(info, expected, 'should have expected info')
      } else {
        t.notOk(info, 'should not have received vendor info')
      }

      checkMetrics(t, testCase.expected_metrics)

      if (info) {
        // There are no mocks currently active, but the module should cache the
        // results.
        t.ok(host.isDone(), 'should have no mocked endpoints')
        getInfo(agent, function getCachedInfo(err, cached) {
          t.same(cached, info, 'should have same data cached')
          t.end()
        })
      } else {
        t.end()
      }
    })
  }

  function checkMetrics(t, expectedMetrics) {
    if (!expectedMetrics) {
      t.equal(agent.metrics._metrics.toJSON().length, 0, 'should not have any metrics')
      return
    }

    Object.keys(expectedMetrics).forEach(function(expectedMetric) {
      var metric = agent.metrics.getOrCreateMetric(expectedMetric)
      t.equal(
        metric.callCount,
        expectedMetrics[expectedMetric].call_count,
        'should have correct metric call count (' + expectedMetric + ')'
      )
    })
  }
}

function formatUrl(opts) {
  if (typeof opts === 'string') {
    return opts
  }
  return (opts.protocol || 'http:') + '//' + opts.host + opts.path
}
