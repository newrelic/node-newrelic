/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const nock = require('nock')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const { checkMetrics, getTestCases } = require('./common')
const JSONbig = require('json-bigint')({ useNativeBigInt: true })

module.exports = async function (t, vendor) {
  const cases = await getTestCases(vendor)
  assert.ok(cases.length > 0, 'should have tests to run')
  const getInfo = require(`../../../lib/utilization/${vendor}-info`)

  t.beforeEach((ctx) => {
    nock.disableNetConnect()
    const agent = helper.loadMockedAgent()
    ctx.nr = { agent }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    getInfo.clearCache()
    nock.cleanAll()
  })

  t.after(function () {
    nock.enableNetConnect()
  })

  for (const testCase of cases) {
    await t.test(testCase.testname, makeTest(testCase, vendor, getInfo))
  }
}

function makeTest(testCase, vendor, getInfo) {
  // aws splits the timeout between token and metadata
  // let's be efficient as possible and assign a lower
  // timeout to aws tests
  const timeout = vendor === 'aws' ? 501 : 1001
  return function (t, end) {
    const { agent } = t.nr
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
        assert.ok(!err, 'should not error getting data')
        assert.deepEqual(info, expected, 'should have expected info')
      } else {
        assert.ok(!info, 'should not have received vendor info')
      }

      checkMetrics(agent, testCase.expected_metrics)

      if (info) {
        // There are no mocks currently active, but the module should cache the
        // results.
        assert.ok(host.isDone(), 'should have no mocked endpoints')
        getInfo(agent, function getCachedInfo(err, cached) {
          assert.deepEqual(cached, info, 'should have same data cached')
          end()
        })
      } else {
        end()
      }
    })
  }
}
