/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const read = require('fs').readFileSync
const join = require('path').join
const https = require('https')
const url = require('url')
const collector = require('../lib/fake-collector')
const RemoteMethod = require('../../lib/collector/remote-method')
const NAMES = require('../../lib/metrics/names')
const { tapAssertMetrics } = require('../lib/metrics_helper')
const { instrumentMockedAgent, unloadAgent } = require('../lib/agent_helper')
const { SSL_HOST } = require('../lib/agent_helper')

tap.test('DataSender (callback style) talking to fake collector', (t) => {
  const config = {
    run_id: 1337,
    ssl: true,
    license_key: 'whatever',
    version: '0',
    max_payload_size_in_bytes: 1000000,
    feature_flag: {}
  }

  const endpoint = {
    host: SSL_HOST,
    port: 8765
  }

  config.certificates = [read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')]
  const agent = { config, metrics: { measureBytes() {} } }
  const method = new RemoteMethod('preconnect', agent, endpoint)

  collector({ port: 8765 }, (error, server) => {
    if (error) {
      t.fail(error)
      return t.end()
    }

    t.teardown(() => {
      return new Promise((resolve) => {
        server.close(resolve)
      })
    })

    method._post('[]', {}, (error, results) => {
      if (error) {
        t.fail(error)
        return t.end()
      }

      t.equal(
        results.payload,
        'collector-1.integration-test:8089',
        'parsed result should come through'
      )
      t.ok(results.status, 'response status code should come through')

      t.end()
    })
  })
})

tap.test('remote method to preconnect', (t) => {
  t.plan(1)

  t.test('https with custom certificate', (t) => {
    t.plan(4)
    const method = createRemoteMethod()

    // create mock collector
    startMockCollector(t, () => {
      method.invoke([], {}, (error, response) => {
        validateResponse(t, error, response)
        t.end()
      })
    })
  })

  function validateResponse(t, error, response) {
    t.error(error, 'should not have an error')
    t.equal(response.payload, 'some-collector-url', 'should get expected response')
    t.ok(response.status, 'should get response status code')
  }

  function createRemoteMethod() {
    const config = {
      ssl: true,
      max_payload_size_in_bytes: 1000000,
      feature_flag: {}
    }

    const endpoint = {
      host: SSL_HOST,
      port: 9876
    }

    config.certificates = [read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')]

    const agent = { config, metrics: { measureBytes() {} } }
    const method = new RemoteMethod('preconnect', agent, endpoint)
    return method
  }

  function startMockCollector(t, startedCallback) {
    const port = 9876
    const opts = {
      port: port
    }

    opts.key = read(join(__dirname, '../lib/test-key.key'))
    opts.cert = read(join(__dirname, '../lib/self-signed-test-certificate.crt'))
    const server = https.createServer(opts, responder)

    server.listen(port, (err) => {
      startedCallback(err, this)
    })

    t.teardown(() => {
      return new Promise((resolve) => {
        server.close(resolve)
      })
    })

    function responder(req, res) {
      const parsed = url.parse(req.url, true)
      t.equal(parsed.query.method, 'preconnect', 'should get redirect host request')
      res.write(JSON.stringify({ return_value: 'some-collector-url' }))
      res.end()
    }
  }
})

tap.test('record data usage supportability metrics', (t) => {
  t.autoend()

  const port = 8765
  let agent
  let server
  let method

  t.beforeEach(async () => {
    agent = instrumentMockedAgent({
      run_id: 1337,
      ssl: true,
      license_key: 'whatever',
      version: '0',
      max_payload_size_in_bytes: 1000000,
      feature_flag: {},
      certificates: [read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')]
    })
    server = await new Promise((resolve, reject) => {
      collector({ port }, (error, server) => {
        return error ? reject(error) : resolve(server)
      })
    })
    method = new RemoteMethod('preconnect', agent, { host: SSL_HOST, port })
  })

  t.afterEach(() => {
    agent && unloadAgent(agent)
    server && server.close()
    method = null
  })

  t.test('should record metrics about data usage', async (t) => {
    const byteLength = (data) => Buffer.byteLength(JSON.stringify(data), 'utf8')
    const payload = [{ hello: 'world' }]
    const payloadSize = byteLength(payload)
    const metric = [1, payloadSize, 35, 19, 19, 361]
    await new Promise((resolve) => {
      method.invoke(payload, resolve)
    })

    tapAssertMetrics(
      t,
      {
        metrics: agent.metrics
      },
      [
        [
          {
            name: NAMES.DATA_USAGE.COLLECTOR
          },
          metric
        ],
        [
          {
            name: `${NAMES.DATA_USAGE.PREFIX}/preconnect/${NAMES.DATA_USAGE.SUFFIX}`
          },
          metric
        ]
      ]
    )

    t.end()
  })
})
