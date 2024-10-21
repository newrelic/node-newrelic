/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { assertMetricValues } = require('../lib/custom-assertions')
const promiseResolvers = require('../lib/promise-resolvers')
const RemoteMethod = require('../../lib/collector/remote-method')
const NAMES = require('../../lib/metrics/names')
const helper = require('../lib/agent_helper')
const Collector = require('../lib/test-collector')

test('DataSender (callback style) talking to fake collector', async (t) => {
  const { promise, resolve, reject } = promiseResolvers()
  const collector = new Collector({ runId: 1337 })
  await collector.listen()

  t.after(() => {
    collector.close()
  })

  const config = {
    run_id: 1337,
    ssl: true,
    license_key: 'whatever',
    version: '0',
    max_payload_size_in_bytes: 1000000,
    feature_flag: {}
  }
  const agent = {
    config: Object.assign({}, config, collector.agentConfig),
    metrics: { measureBytes() {} }
  }

  const endpoint = {
    host: collector.host,
    port: collector.port
  }

  collector.addHandler(helper.generateCollectorPath('preconnect', 1337), async (req, res) => {
    let validation = collector.validators.queryString(req.query)
    validation = collector.validators.httpHeaders(req, validation)

    const body = JSON.parse(await req.body())
    if (Array.isArray(body) === false || body.length) {
      validation.body_errors = [`preconnect expects a body of '[]'`]
    }

    const result = {
      return_value: { redirect_host: `${collector.host}:${collector.port}` }
    }
    if (Object.keys(validation).length > 0) {
      assert.fail('should not have violated any validation constraints')
    }
    res.json({ payload: result })
  })

  const method = new RemoteMethod('preconnect', agent, endpoint)
  method._post('[]', {}, (error, results) => {
    if (error) {
      return reject(error)
    }

    assert.deepStrictEqual(
      results.payload,
      { redirect_host: `${collector.host}:${collector.port}` },
      'parsed result should come through'
    )
    assert.ok(results.status, 'response status code should come through')

    resolve()
  })

  await promise
})

test('should record metrics about data usage', async (t) => {
  const collector = new Collector({ runId: 1337 })
  await collector.listen()

  const config = {
    run_id: 1337,
    ssl: true,
    license_key: 'whatever',
    version: '0',
    max_payload_size_in_bytes: 1000000,
    feature_flag: {}
  }
  const agent = helper.instrumentMockedAgent({
    ...config,
    ...collector.agentConfig
  })

  t.after(() => {
    collector.close()
    helper.unloadAgent(agent)
  })

  const endpoint = {
    host: collector.host,
    port: collector.port
  }
  const method = new RemoteMethod('preconnect', agent, endpoint)

  const byteLength = (data) => Buffer.byteLength(JSON.stringify(data), 'utf8')
  const payload = [{ hello: 'world' }]
  const payloadSize = byteLength(payload)
  const expectedMeasurement = byteLength({
    redirect_host: `${endpoint.host}:${endpoint.port}`,
    security_policies: {}
  })
  const metric = [1, payloadSize, expectedMeasurement, 19, 19, 361]
  await new Promise((resolve) => {
    method.invoke(payload, resolve)
  })

  assertMetricValues({ metrics: agent.metrics }, [
    [{ name: NAMES.DATA_USAGE.COLLECTOR }, metric],
    [
      {
        name: `${NAMES.DATA_USAGE.PREFIX}/preconnect/${NAMES.DATA_USAGE.SUFFIX}`
      },
      metric
    ]
  ])
})
