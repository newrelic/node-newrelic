/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const proxyquire = require('proxyquire')
const helper = require('../../lib/agent_helper')
const { checkMetrics, getTestCases } = require('./common')
const common = require('../../../lib/utilization/common')
const LocalMetadataServer = require('../../lib/local-metadata-server')
const JSONbig = require('json-bigint')({ useNativeBigInt: true })

module.exports = async function (t, vendor) {
  const cases = await getTestCases(vendor)
  assert.ok(cases.length > 0, 'should have tests to run')

  t.beforeEach(async (ctx) => {
    const server = new LocalMetadataServer()
    await server.listen()
    // `proxyquire` the vendor module's `resolveMetadataHost` to point at
    // `server` instead of defining an environment variable.
    const getInfo = proxyquire(`../../../lib/utilization/${vendor}-info`, {
      './common': {
        ...common,
        resolveMetadataHost: () => { return { host: server.host, port: server.port } }
      }
    })
    const agent = helper.loadMockedAgent()
    ctx.nr = { agent, getInfo, server }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.getInfo.clearCache()
    ctx.nr.server.close()
  })

  for (const testCase of cases) {
    await t.test(testCase.testname, makeTest(testCase, vendor))
  }
}

function makeTest(testCase, vendor) {
  // aws splits the timeout between token and metadata
  // let's be efficient as possible and assign a lower
  // timeout to aws tests
  const timeout = vendor === 'aws' ? 501 : 1001
  return function (t, end) {
    const { agent, getInfo, server } = t.nr
    const routes = []

    // The fixture's host is ignored -- the agent is redirected to `server`
    // via the proxyquired `resolveMetadataHost`. Only the path (query
    // string stripped) is used for routing.
    for (const uri of Object.keys(testCase.uri)) {
      const responseData = testCase.uri[uri]
      const endpoint = '/' + uri.split('/').slice(3).join('/').split('?')[0]
      const body = JSONbig.stringify(responseData.response || '')
      const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }

      routes.push(
        server.addRoute('GET', endpoint, (req, res) => {
          if (responseData.timeout) {
            const timer = setTimeout(() => {
              res.writeHead(200, headers)
              res.end(body)
            }, timeout)
            res.on('close', () => clearTimeout(timer))
          } else {
            res.writeHead(200, headers)
            res.end(body)
          }
        })
      )
    }

    // This may be messy but AWS makes an extra call to get an auth token
    // we need to mock out once
    if (vendor === 'aws') {
      const tokenBody = 'awsAuthToken'
      server.addRoute('PUT', '/latest/api/token', (req, res) => {
        res.writeHead(200, { 'Content-Length': Buffer.byteLength(tokenBody) })
        res.end(tokenBody)
      })
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
        assert.ok(routes.every((route) => route.isDone()), 'should have hit the mocked endpoint(s)')
        getInfo(agent, function getCachedInfo(err, cached) {
          assert.ifError(err)
          assert.deepEqual(cached, info, 'should have same data cached')
          end()
        })
      } else {
        end()
      }
    })
  }
}
