/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')
const API = require('../../../api')
const { getTestSecret } = require('../../helpers/secrets')
const license = getTestSecret('LASP_LICENSE')

test('LASP-enabled agent', async (t) => {
  t.beforeEach(function (ctx) {
    const config = configurator.initialize({
      app_name: 'node.js Tests',
      license_key: license,
      security_policies_token: 'ffff-ffff-ffff-ffff',
      host: 'staging-collector.newrelic.com',
      port: 443,
      ssl: true,
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_gcp: false,
        detect_docker: false
      },
      logging: {
        level: 'trace'
      }
    })

    const agent = new Agent(config)
    const api = new API(agent)

    // Agent cannot create transactions from initial 'stopped' state
    agent.setState('started')
    ctx.nr = {
      agent,
      api
    }
  })

  await t.test('drops full trace if custom attributes are disabled by LASP', function (t, end) {
    const { agent, api } = t.nr
    let transaction
    const proxy = agent.tracer.transactionProxy(function () {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromWeb(200)
      // ensure it's slow enough to get traced
      transaction.trace.setDurationInMillis(5001)
      api.addCustomAttribute('foo', 'bar')
      api.addCustomAttribute('fizz', 'buzz')
      const attributes = transaction.trace.custom.attributes
      assert.deepEqual(
        Object.keys(attributes),
        ['foo', 'fizz'],
        'transaction trace has custom attributes'
      )
    })
    proxy()

    transaction.end()
    assert.ok(agent.traces.trace, 'should have a trace before connect')

    agent.start(function (error) {
      assert.ok(!error, 'connected without error')
      assert.ok(!agent.traces.trace, 'should no longer have a trace')

      agent.stop(function (error) {
        assert.ok(!error, 'stopped without error')

        end()
      })
    })
  })

  await t.test('drops full trace if attributes.include is disabled by LASP', function (t, end) {
    const { agent, api } = t.nr
    agent.config.attributes.include = ['f*']
    agent.config.emit('attributes.include')
    let transaction
    const proxy = agent.tracer.transactionProxy(function () {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromWeb(200)
      // ensure it's slow enough to get traced
      transaction.trace.setDurationInMillis(5001)
      api.addCustomAttribute('foo', 'bar')
      api.addCustomAttribute('fizz', 'buzz')
      const attributes = transaction.trace.custom.attributes
      assert.deepEqual(
        Object.keys(attributes),
        ['foo', 'fizz'],
        'transaction trace has custom attributes'
      )
    })
    proxy()

    transaction.end()
    assert.ok(agent.traces.trace, 'should have a trace before connect')

    agent.start(function (error) {
      assert.ok(!error, 'connected without error')
      assert.ok(!agent.traces.trace, 'should no longer have a trace')

      agent.stop(function (error) {
        assert.ok(!error, 'stopped without error')

        end()
      })
    })
  })
})
