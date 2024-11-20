/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const net = require('net')
const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')
const CollectorAPI = require('../../lib/collector/api')
const { getTestSecret } = require('../helpers/secrets')
const license = getTestSecret('TEST_LICENSE')
const { tspl } = require('@matteo.collina/tspl')

test('proxy authentication should set headers', async (t) => {
  const plan = tspl(t, { plan: 2 })

  const server = net.createServer()

  server.on('connection', (socket) => {
    socket.on('data', (chunk) => {
      const data = chunk.toString().split('\r\n')
      plan.equal(data[0], 'CONNECT staging-collector.newrelic.com:443 HTTP/1.1')
      plan.equal(data[1], 'Proxy-Authorization: Basic YTpi')
      server.close()
    })
    socket.end()
  })

  server.listen(0, () => {
    const port = server.address().port
    const config = configurator.initialize({
      app_name: 'node.js Tests',
      license_key: license,
      host: 'staging-collector.newrelic.com',
      port: 443,
      proxy: `http://a:b@localhost:${port}`,
      ssl: true,
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_azure: false,
        detect_gcp: false,
        detect_docker: false
      },
      logging: {
        level: 'trace'
      }
    })
    const agent = new Agent(config)
    const api = new CollectorAPI(agent)

    api.connect(() => {
      // need a callback even though we dont care and
      // are just asserting some of the outgoing http requests above
    })
  })

  await plan.completed
})
