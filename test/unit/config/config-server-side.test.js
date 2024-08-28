/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Config = require('../../../lib/config')

test('when receiving server-side configuration', async (t) => {
  // Unfortunately, the Config currently relies on initialize to
  // instantiate the logger in the module which is later leveraged
  // by methods on the instantiated Config instance.
  Config.initialize({})

  let config = null

  t.beforeEach(() => {
    config = new Config()
  })

  await t.test('should set the agent run ID', () => {
    config.onConnect({ agent_run_id: 1234 })
    assert.equal(config.run_id, 1234)
  })

  await t.test('should set the account ID', () => {
    config.onConnect({ account_id: 76543 })
    assert.equal(config.account_id, 76543)
  })

  await t.test('should set the entity GUID', () => {
    config.onConnect({ entity_guid: 1729 })
    assert.equal(config.entity_guid, 1729)
  })

  await t.test('should set the application ID', () => {
    config.onConnect({ application_id: 76543 })
    assert.equal(config.application_id, 76543)
  })

  await t.test('should always respect collect_traces', () => {
    assert.equal(config.collect_traces, true)

    config.onConnect({ collect_traces: false })
    assert.equal(config.collect_traces, false)
  })

  await t.test('should disable the transaction tracer when told to', () => {
    assert.equal(config.transaction_tracer.enabled, true)

    config.onConnect({ 'transaction_tracer.enabled': false })
    assert.equal(config.transaction_tracer.enabled, false)
  })

  await t.test('should always respect collect_errors', () => {
    assert.equal(config.collect_errors, true)

    config.onConnect({ collect_errors: false })
    assert.equal(config.collect_errors, false)
  })

  await t.test('should always respect collect_span_events', () => {
    assert.equal(config.collect_span_events, true)
    assert.equal(config.span_events.enabled, true)

    config.onConnect({ collect_span_events: false })
    assert.equal(config.span_events.enabled, false)
  })

  await t.test('should disable the error tracer when told to', () => {
    assert.equal(config.error_collector.enabled, true)

    config.onConnect({ 'error_collector.enabled': false })
    assert.equal(config.error_collector.enabled, false)
  })

  await t.test('should set apdex_t', () => {
    assert.equal(config.apdex_t, 0.1)

    config.on('apdex_t', (value) => {
      assert.equal(value, 0.05)
      assert.equal(config.apdex_t, 0.05)
    })

    config.onConnect({ apdex_t: 0.05 })
  })

  await t.test('should map transaction_tracer.transaction_threshold', () => {
    assert.equal(config.transaction_tracer.transaction_threshold, 'apdex_f')

    config.onConnect({ 'transaction_tracer.transaction_threshold': 0.75 })
    assert.equal(config.transaction_tracer.transaction_threshold, 0.75)
  })

  await t.test('should map URL rules to the URL normalizer', () => {
    config.on('url_rules', function (rules) {
      assert.deepEqual(rules, [{ name: 'sample_rule' }])
    })

    config.onConnect({ url_rules: [{ name: 'sample_rule' }] })
  })

  await t.test('should map metric naming rules to the metric name normalizer', () => {
    config.on('metric_name_rules', function (rules) {
      assert.deepEqual(rules, [{ name: 'sample_rule' }])
    })

    config.onConnect({ metric_name_rules: [{ name: 'sample_rule' }] })
  })

  await t.test('should map txn naming rules to the txn name normalizer', () => {
    config.on('transaction_name_rules', function (rules) {
      assert.deepEqual(rules, [{ name: 'sample_rule' }])
    })

    config.onConnect({ transaction_name_rules: [{ name: 'sample_rule' }] })
  })

  await t.test('should log the product level', () => {
    assert.equal(config.product_level, 0)
    config.onConnect({ product_level: 30 })

    assert.equal(config.product_level, 30)
  })

  await t.test('should reject high_security', () => {
    config.onConnect({ high_security: true })
    assert.equal(config.high_security, false)
  })

  await t.test('should disable ai monitoring', () => {
    config.ai_monitoring.enabled = true
    assert.equal(config.ai_monitoring.enabled, true)
    config.onConnect({ collect_ai: false })
    assert.equal(config.ai_monitoring.enabled, false)
  })

  await t.test('should configure cross application tracing', () => {
    config.cross_application_tracer.enabled = true

    config.onConnect({ 'cross_application_tracer.enabled': false })
    assert.equal(config.cross_application_tracer.enabled, false)
  })

  await t.test('should load named transaction apdexes', () => {
    const apdexes = { 'WebTransaction/Custom/UrlGenerator/en/betting/Football': 7.0 }
    assert.deepEqual(config.web_transactions_apdex, {})

    config.onConnect({ web_transactions_apdex: apdexes })
    assert.deepEqual(config.web_transactions_apdex, apdexes)
  })

  await t.test('should not configure record_sql', () => {
    assert.equal(config.transaction_tracer.record_sql, 'obfuscated')

    config.onConnect({ 'transaction_tracer.record_sql': 'raw' })
    assert.equal(config.transaction_tracer.record_sql, 'obfuscated')
  })

  await t.test('should not configure explain_threshold', () => {
    assert.equal(config.transaction_tracer.explain_threshold, 500)
    config.onConnect({ 'transaction_tracer.explain_threshold': 100 })
    assert.equal(config.transaction_tracer.explain_threshold, 500)
  })

  await t.test('should not configure slow_sql.enabled', () => {
    assert.equal(config.slow_sql.enabled, false)

    config.onConnect({ 'transaction_tracer.enabled': true })
    assert.equal(config.slow_sql.enabled, false)
  })

  await t.test('should not configure slow_sql.max_samples', () => {
    assert.equal(config.slow_sql.max_samples, 10)

    config.onConnect({ 'transaction_tracer.max_samples': 5 })
    assert.equal(config.slow_sql.max_samples, 10)
  })

  await t.test('should not blow up when sampling_rate is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ sampling_rate: 0 })
    })
  })

  await t.test('should not blow up when cross_process_id is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ cross_process_id: 'junk' })
    })
  })

  await t.test('should not blow up with cross_application_tracer.enabled', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ 'cross_application_tracer.enabled': true })
    })
  })

  await t.test('should not blow up when encoding_key is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ encoding_key: 'hamsnadwich' })
    })
  })

  await t.test('should not blow up when trusted_account_ids is received', () => {
    config.once('trusted_account_ids', (value) => {
      assert.deepEqual(value, [1, 2, 3], 'should get the initial keys')
    })

    assert.doesNotThrow(() => {
      config.onConnect({ trusted_account_ids: [1, 2, 3] })
    }, 'should allow it once')

    config.once('trusted_account_ids', (value) => {
      assert.deepEqual(value, [2, 3, 4], 'should get the modified keys')
    })

    assert.doesNotThrow(() => {
      config.onConnect({ trusted_account_ids: [2, 3, 4] })
    }, 'should allow modification')
  })

  await t.test('should not blow up when trusted_account_key is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ trusted_account_key: 123 })
    })
  })

  await t.test('should not blow up when high_security is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ high_security: true })
    })
  })

  await t.test('should not blow up when ssl is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ ssl: true })
    })
  })

  await t.test('should not disable ssl', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ ssl: false })
    })
    assert.equal(config.ssl, true)
  })

  await t.test('should not blow up when transaction_tracer.record_sql is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ 'transaction_tracer.record_sql': true })
    })
  })

  await t.test('should not blow up when slow_sql.enabled is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ 'slow_sql.enabled': true })
    })
  })

  await t.test('should not blow up when rum.load_episodes_file is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ 'rum.load_episodes_file': true })
    })
  })

  await t.test('should not blow up when browser_monitoring.loader is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ 'browser_monitoring.loader': 'none' })
    })
  })

  await t.test('should not blow up when beacon is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ beacon: 'beacon-0.newrelic.com' })
    })
  })

  await t.test('should not blow up when error beacon is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ error_beacon: null })
    })
  })

  await t.test('should not blow up when js_agent_file is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ js_agent_file: 'jxc4afffef.js' })
    })
  })

  await t.test('should not blow up when js_agent_loader_file is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ js_agent_loader_file: 'nr-js-bootstrap.js' })
    })
  })

  await t.test('should not blow up when episodes_file is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ episodes_file: 'js-agent.newrelic.com/nr-100.js' })
    })
  })

  await t.test('should not blow up when episodes_url is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ episodes_url: 'https://js-agent.newrelic.com/nr-100.js' })
    })
  })

  await t.test('should not blow up when browser_key is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ browser_key: 'beefchunx' })
    })
  })

  await t.test('should not blow up when collect_analytics_events is received', () => {
    config.transaction_events.enabled = true
    assert.doesNotThrow(() => {
      config.onConnect({ collect_analytics_events: false })
    })
    assert.equal(config.transaction_events.enabled, false)
  })

  await t.test('should not blow up when collect_custom_events is received', () => {
    config.custom_insights_events.enabled = true
    assert.doesNotThrow(() => {
      config.onConnect({ collect_custom_events: false })
    })
    assert.equal(config.custom_insights_events.enabled, false)
  })

  await t.test('should not blow up when transaction_events.enabled is received', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ 'transaction_events.enabled': false })
    })
    assert.equal(config.transaction_events.enabled, false)
  })

  await t.test('should override default max_payload_size_in_bytes', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ max_payload_size_in_bytes: 100 })
    })
    assert.equal(config.max_payload_size_in_bytes, 100)
  })

  await t.test('should not accept serverless_mode', () => {
    assert.doesNotThrow(() => {
      config.onConnect({ 'serverless_mode.enabled': true })
    })
    assert.equal(config.serverless_mode.enabled, false)
  })

  await t.test('when handling embedded agent_config', async (t) => {
    await t.test('should not blow up when agent_config is passed in', () => {
      assert.doesNotThrow(() => {
        config.onConnect({ agent_config: {} })
      })
    })

    await t.test('should ignore status codes set on the server', () => {
      config.onConnect({
        agent_config: {
          'error_collector.ignore_status_codes': [401, 409, 415]
        }
      })
      assert.deepEqual(config.error_collector.ignore_status_codes, [404, 401, 409, 415])
    })

    await t.test('should ignore status codes set on the server as strings', () => {
      config.onConnect({
        agent_config: {
          'error_collector.ignore_status_codes': ['401', '409', '415']
        }
      })
      assert.deepEqual(config.error_collector.ignore_status_codes, [404, 401, 409, 415])
    })

    await t.test('should ignore status codes set on the server when using a range', () => {
      config.onConnect({
        agent_config: {
          'error_collector.ignore_status_codes': [401, '420-421', 415, 'abc']
        }
      })
      assert.deepEqual(config.error_collector.ignore_status_codes, [404, 401, 420, 421, 415])
    })

    await t.test(
      'should not error out when ignore status codes are neither numbers nor strings',
      () => {
        config.onConnect({
          agent_config: {
            'error_collector.ignore_status_codes': [{ non: 'sense' }]
          }
        })
        assert.deepEqual(config.error_collector.ignore_status_codes, [404])
      }
    )

    await t.test('should not add codes that parse to NaN', () => {
      config.onConnect({
        agent_config: {
          'error_collector.ignore_status_codes': ['abc']
        }
      })
      assert.deepEqual(config.error_collector.ignore_status_codes, [404])
    })

    await t.test('should not ignore status codes from server with invalid range', () => {
      config.onConnect({
        agent_config: {
          'error_collector.ignore_status_codes': ['421-420']
        }
      })
      assert.deepEqual(config.error_collector.ignore_status_codes, [404])
    })

    await t.test('should not ignore status codes from server if given out of range', () => {
      config.onConnect({
        agent_config: {
          'error_collector.ignore_status_codes': ['1-1776']
        }
      })
      assert.deepEqual(config.error_collector.ignore_status_codes, [404])
    })

    await t.test('should ignore negative status codes from server', () => {
      config.onConnect({
        agent_config: {
          'error_collector.ignore_status_codes': [-7]
        }
      })
      assert.deepEqual(config.error_collector.ignore_status_codes, [404, -7])
    })

    await t.test('should set `span_event_harvest_config` from server', () => {
      const spanEventHarvestConfig = {
        report_period_ms: 1000,
        harvest_limit: 10000
      }
      config.onConnect({
        agent_config: {
          span_event_harvest_config: spanEventHarvestConfig
        }
      })

      assert.deepEqual(config.span_event_harvest_config, spanEventHarvestConfig)
    })

    const ignoreServerConfigFlags = [true, false]
    for (const ignoreServerConfig of ignoreServerConfigFlags) {
      await t.test(
        `should ${
          ignoreServerConfig ? 'not ' : ''
        }update local configuration with server side config values when ignore_server_configuration is set to ${ignoreServerConfig}`,
        () => {
          assert.equal(config.slow_sql.enabled, false)
          assert.equal(config.transaction_tracer.enabled, true)
          const serverSideConfig = {
            'slow_sql.enabled': true,
            'transaction_tracer.enabled': false
          }
          config.ignore_server_configuration = ignoreServerConfig

          config.onConnect({
            agent_config: serverSideConfig
          })

          // should stay same if `ignore_server_configuration` is true
          if (ignoreServerConfig) {
            assert.equal(config.slow_sql.enabled, false)
            assert.equal(config.transaction_tracer.enabled, true)
            // should use updated value if `ignore_server_configuration` is false
          } else {
            assert.equal(config.slow_sql.enabled, true)
            assert.equal(config.transaction_tracer.enabled, false)
          }
        }
      )
    }
  })

  await t.test('when event_harvest_config is set', async (t) => {
    await t.test('should emit event_harvest_config when harvest interval is changed', () => {
      const expectedHarvestConfig = {
        report_period_ms: 5000,
        harvest_limits: {
          analytic_event_data: 833,
          custom_event_data: 833,
          error_event_data: 8
        }
      }

      config.once('event_harvest_config', function (harvestconfig) {
        assert.deepEqual(harvestconfig, expectedHarvestConfig)
      })

      config.onConnect({ event_harvest_config: expectedHarvestConfig })
    })

    await t.test('should emit null when an invalid report period is provided', () => {
      const invalidHarvestConfig = {
        report_period_ms: -1,
        harvest_limits: {
          analytic_event_data: -1,
          custom_event_data: -1,
          error_event_data: -1
        }
      }

      config.once('event_harvest_config', function (harvestconfig) {
        assert.deepEqual(harvestconfig, null, 'emitted value should be null')
      })

      config.onConnect({ event_harvest_config: invalidHarvestConfig })
    })

    await t.test('should update event_harvest_config when a sub-value changed', () => {
      const originalHarvestConfig = {
        report_period_ms: 60000,
        harvest_limits: {
          analytic_event_data: 10000,
          custom_event_data: 10000,
          error_event_data: 100
        }
      }

      config.event_harvest_config = originalHarvestConfig

      const expectedHarvestConfig = {
        report_period_ms: 5000,
        harvest_limits: {
          analytic_event_data: 833,
          custom_event_data: 833,
          error_event_data: 8
        }
      }

      config.once('event_harvest_config', function (harvestconfig) {
        assert.deepEqual(harvestconfig, expectedHarvestConfig)
      })

      config.onConnect({ event_harvest_config: expectedHarvestConfig })
    })

    await t.test('should ignore invalid limits on event_harvest_config', () => {
      const originalHarvestConfig = {
        report_period_ms: 60000,
        harvest_limits: {
          analytic_event_data: 10000,
          custom_event_data: 10000,
          error_event_data: 100
        }
      }

      config.event_harvest_config = originalHarvestConfig

      const invalidHarvestLimits = {
        report_period_ms: 60000,
        harvest_limits: {
          analytic_event_data: -1,
          custom_event_data: -1,
          error_event_data: 200
        }
      }

      const cleanedHarvestLimits = {
        report_period_ms: 60000,
        harvest_limits: {
          error_event_data: 200
        }
      }

      config.once('event_harvest_config', function (harvestconfig) {
        assert.deepEqual(harvestconfig, cleanedHarvestLimits, 'should not include invalid limits')
      })

      config.onConnect({ event_harvest_config: invalidHarvestLimits })
    })
  })

  await t.test('when apdex_t is set', async (t) => {
    await t.test('should emit `apdex_t` when apdex_t changes', () => {
      config.once('apdex_t', function (apdexT) {
        assert.equal(apdexT, 0.75)
      })

      config.onConnect({ apdex_t: 0.75 })
    })

    await t.test('should update its apdex_t only when it has changed', () => {
      assert.equal(config.apdex_t, 0.1)

      config.once('apdex_t', function () {
        throw new Error('should never get here')
      })

      config.onConnect({ apdex_t: 0.1 })
    })
  })
})
