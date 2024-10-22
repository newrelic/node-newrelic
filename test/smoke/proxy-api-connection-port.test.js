/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')

const { getTestSecret } = require('../helpers/secrets')
const fakeCert = require('../lib/fake-cert')
const createServer = require('../lib/proxy-server')
const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')
const CollectorAPI = require('../../lib/collector/api')

const license = getTestSecret('TEST_LICENSE')

test('setting proxy_port should use the proxy agent', async (t) => {
  const plan = tspl(t, { plan: 8 })

  const cert = fakeCert({ commonName: 'staging-collector.newrelic.com' })
  const proxy = await createServer(cert)
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: license,
    host: 'staging-collector.newrelic.com',
    port: 443,
    proxy_host: '127.0.0.1',
    proxy_port: proxy.address().port,
    ssl: true,
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    },
    logging: { level: 'trace' },
    certificates: [cert.certificate]
  })
  const agent = new Agent(config)
  const api = new CollectorAPI(agent)

  t.after(() => {
    proxy.shutdown()
  })

  api.connect((error, response) => {
    plan.ifError(error, 'error during connection')

    const returned = response?.payload
    plan.ok(returned, 'got boot configuration')
    plan.ok(returned.agent_run_id, 'got run ID')
    plan.ok(agent.config.run_id, 'run ID set in configuration')
    plan.equal(returned.agent_run_id, agent.config.run_id)

    api.shutdown((error) => {
      plan.ifError(error, 'should have shutdown without issue')
      plan.equal(agent.config.run_id, undefined, 'run ID should have been cleared by shutdown')
      plan.equal(proxy.proxyUsed, true, 'proxy must be used')
    })
  })

  await plan.completed
})
