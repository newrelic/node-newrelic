/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')
const API = require('../../../api')
const {getTestSecret, shouldSkipTest} = require('../../helpers/secrets')


const license = getTestSecret('LASP_LICENSE')
const skip = shouldSkipTest(license)
tap.skip('LASP-enabled agent', {skip}, (t) => {
  let agent = null
  let api = null
  let config = null

  t.beforeEach(function(done) {
    config = configurator.initialize({
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

    agent = new Agent(config)
    api = new API(agent)

    // Agent cannot create transactions from initial 'stopped' state
    agent.setState('started')

    done()
  })

  t.test('drops full trace if custom attributes are disabled by LASP', function(t) {
    var transaction
    var proxy = agent.tracer.transactionProxy(function() {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 200)
      // ensure it's slow enough to get traced
      transaction.trace.setDurationInMillis(5001)
      api.addCustomAttribute('foo', 'bar')
      api.addCustomAttribute('fizz', 'buzz')
      var attributes = transaction.trace.custom.attributes
      t.deepEqual(
        Object.keys(attributes),
        ['foo', 'fizz'],
        'transaction trace has custom attributes'
      )
    })
    proxy()

    transaction.end()
    t.ok(agent.traces.trace, 'should have a trace before connect')

    agent.start(function(error) {
      t.error(error, 'connected without error')
      t.notOk(agent.traces.trace, 'should no longer have a trace')

      agent.stop(function(error) {
        t.error(error, 'stopped without error')

        t.end()
      })
    })
  })

  t.test('drops full trace if attributes.include is disabled by LASP', function(t) {
    agent.config.attributes.include = [ 'f*' ]
    agent.config.emit('attributes.include')
    var transaction
    var proxy = agent.tracer.transactionProxy(function() {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 200)
      // ensure it's slow enough to get traced
      transaction.trace.setDurationInMillis(5001)
      api.addCustomAttribute('foo', 'bar')
      api.addCustomAttribute('fizz', 'buzz')
      var attributes = transaction.trace.custom.attributes
      t.deepEqual(
        Object.keys(attributes),
        ['foo', 'fizz'],
        'transaction trace has custom attributes'
      )
    })
    proxy()

    transaction.end()
    t.ok(agent.traces.trace, 'should have a trace before connect')

    agent.start(function(error) {
      t.error(error, 'connected without error')
      t.notOk(agent.traces.trace, 'should no longer have a trace')

      agent.stop(function(error) {
        t.error(error, 'stopped without error')

        t.end()
      })
    })
  })

  t.autoend()
})
