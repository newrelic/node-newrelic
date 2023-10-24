/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const nock = require('nock')
const fs = require('fs')
const helper = require('../../lib/agent_helper')
const JSONbig = require('json-bigint')({ useNativeBigInt: true })

module.exports = function (t, vendor) {
  const testFile = path.resolve(
    __dirname,
    '../../lib/cross_agent_tests/utilization_vendor_specific',
    vendor + '.json'
  )
  const getInfo = require('../../../lib/utilization/' + vendor + '-info')

  nock.disableNetConnect()
  t.teardown(function () {
    nock.enableNetConnect()
  })

  fs.readFile(testFile, function (err, data) {
    if (!t.error(err, 'should not error loading tests')) {
      t.fail('Could not load tests!')
      t.end()
      return
    }

    const cases = JSONbig.parse(data)

    t.autoend()
    t.ok(cases.length > 0, 'should have tests to run')

    for (let i = 0; i < cases.length; ++i) {
      t.test(cases[i].testname, makeTest(cases[i], vendor, getInfo))
    }
  })
}

function makeTest(testCase, vendor, getInfo) {
  // aws splits the timeout between token and metadata
  // let's be efficient as possible and assign a lower
  // timeout to aws tests
  const timeout = vendor === 'aws' ? 501 : 1001
  let agent = null
  return function (t) {
    agent = helper.loadMockedAgent()
    t.teardown(function () {
      helper.unloadAgent(agent)
      getInfo.clearCache()
      nock.cleanAll()
    })

    let redirection = null
    const uris = Object.keys(testCase.uri)

    let host = null
    for (let i = 0; i < uris.length; ++i) {
      const uri = uris[i]
      const responseData = testCase.uri[uri]
      const hostUrl = uri.split('/').slice(0, 3).join('/')
      const endpoint = '/' + uri.split('/').slice(3).join('/')
      host = host || nock(hostUrl)

      redirection = host.get(endpoint)

      if (responseData.timeout) {
        redirection = redirection.delay(timeout)
      }
      redirection.reply(200, JSONbig.stringify(responseData.response || ''))
    }

    // This may be messy but AWS makes an extra call to get an auth token
    // we need to nock this out once
    if (vendor === 'aws') {
      host.put('/latest/api/token').reply(200, 'awsAuthToken')
    }

    getInfo(agent, function (err, info) {
      if (testCase.expected_vendors_hash) {
        const expected = testCase.expected_vendors_hash[vendor]
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

    Object.keys(expectedMetrics).forEach(function (expectedMetric) {
      const metric = agent.metrics.getOrCreateMetric(expectedMetric)
      t.equal(
        metric.callCount,
        expectedMetrics[expectedMetric].call_count,
        'should have correct metric call count (' + expectedMetric + ')'
      )
    })
  }
}
