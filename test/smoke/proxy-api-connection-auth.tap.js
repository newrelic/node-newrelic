/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const net = require('net')
const tap = require('tap')
const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')
const CollectorAPI = require('../../lib/collector/api')
const { getTestSecret } = require('../helpers/secrets')
const license = getTestSecret('TEST_LICENSE')

tap.test('proxy authentication should set headers', (t) => {
  t.plan(2)

  const server = net.createServer()

  server.on('connection', (socket) => {
    socket.on('data', (chunk) => {
      const data = chunk.toString().split('\r\n')
      t.equal(data[0], 'CONNECT staging-collector.newrelic.com:443 HTTP/1.1')
      t.equal(data[1], 'Proxy-Authorization: Basic YTpi')
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
      t.end()
    })
  })
})
