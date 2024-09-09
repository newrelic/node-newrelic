/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('path')

const Config = require('../../../lib/config')

test('with default properties', async (t) => {
  let configuration = null

  t.beforeEach(() => {
    configuration = Config.initialize({})

    // ensure environment is clean
    delete configuration.newrelic_home
  })

  await t.test('should have no application name', () => {
    assert.deepStrictEqual(configuration.app_name, [])
  })

  await t.test('should return no application name', () => {
    assert.deepStrictEqual(configuration.applications(), [])
  })

  await t.test('should have no application ID', () => {
    assert.equal(configuration.application_id, null)
  })

  await t.test('should have no license key', () => {
    assert.equal(configuration.license_key, '')
  })

  await t.test('should connect to the collector at collector.newrelic.com', () => {
    assert.equal(configuration.host, 'collector.newrelic.com')
  })

  await t.test('should connect to the collector on port 443', () => {
    assert.equal(configuration.port, 443)
  })

  await t.test('should have SSL enabled', () => {
    assert.equal(configuration.ssl, true)
  })

  await t.test('should have no security_policies_token', () => {
    assert.equal(configuration.security_policies_token, '')
  })

  await t.test('should have no proxy host', () => {
    assert.equal(configuration.proxy_host, '')
  })

  await t.test('should have no proxy port', () => {
    assert.equal(configuration.proxy_port, '')
  })

  await t.test('should enable the agent', () => {
    assert.equal(configuration.agent_enabled, true)
  })

  await t.test('should have an apdexT of 0.1', () => {
    assert.equal(configuration.apdex_t, 0.1)
  })

  await t.test('should have a null account_id', () => {
    assert.equal(configuration.account_id, null)
  })

  await t.test('should have a null primary_application_id', () => {
    assert.equal(configuration.primary_application_id, null)
  })

  await t.test('should have a null trusted_account_key', () => {
    assert.equal(configuration.trusted_account_key, null)
  })

  await t.test('should have the default excluded request attributes', () => {
    assert.deepStrictEqual(configuration.attributes.exclude, [])
  })

  await t.test('should have the default attribute include setting', () => {
    assert.equal(configuration.attributes.include_enabled, true)
  })

  await t.test('should have the default error message redaction setting ', () => {
    assert.equal(configuration.strip_exception_messages.enabled, false)
  })

  await t.test('should enable transaction event attributes', () => {
    assert.equal(configuration.transaction_events.attributes.enabled, true)
  })

  await t.test('should log at the info level', () => {
    assert.equal(configuration.logging.level, 'info')
  })

  await t.test('should have a log filepath of process.cwd + newrelic_agent.log', () => {
    const logPath = path.join(process.cwd(), 'newrelic_agent.log')
    assert.equal(configuration.logging.filepath, logPath)
  })

  await t.test('should enable the error collector', () => {
    assert.equal(configuration.error_collector.enabled, true)
  })

  await t.test('should enable error collector attributes', () => {
    assert.equal(configuration.error_collector.attributes.enabled, true)
  })

  await t.test('should ignore status code 404', () => {
    assert.deepStrictEqual(configuration.error_collector.ignore_status_codes, [404])
  })

  await t.test('should enable the transaction tracer', () => {
    assert.equal(configuration.transaction_tracer.enabled, true)
  })

  await t.test('should enable transaction tracer attributes', () => {
    assert.equal(configuration.transaction_tracer.attributes.enabled, true)
  })

  await t.test('should set the transaction tracer threshold to `apdex_f`', () => {
    assert.equal(configuration.transaction_tracer.transaction_threshold, 'apdex_f')
  })

  await t.test('should collect one slow transaction trace per harvest cycle', () => {
    assert.equal(configuration.transaction_tracer.top_n, 20)
  })

  await t.test('should obfsucate sql by default', () => {
    assert.equal(configuration.transaction_tracer.record_sql, 'obfuscated')
  })

  await t.test('should have an explain threshold of 500ms', () => {
    assert.equal(configuration.transaction_tracer.explain_threshold, 500)
  })

  await t.test('should not capture slow queries', () => {
    assert.equal(configuration.slow_sql.enabled, false)
  })

  await t.test('should capture a maximum of 10 slow-queries per harvest', () => {
    assert.equal(configuration.slow_sql.max_samples, 10)
  })

  await t.test('should have no naming rules', () => {
    assert.equal(configuration.rules.name.length, 0)
  })

  await t.test('should have one default ignoring rules', () => {
    assert.equal(configuration.rules.ignore.length, 1)
  })

  await t.test('should enforce URL backstop', () => {
    assert.equal(configuration.enforce_backstop, true)
  })

  await t.test('should allow passed-in config to override errors ignored', () => {
    configuration = Config.initialize({
      error_collector: {
        ignore_status_codes: []
      }
    })

    assert.deepStrictEqual(configuration.error_collector.ignore_status_codes, [])
  })

  await t.test('should disable cross application tracer', () => {
    assert.equal(configuration.cross_application_tracer.enabled, false)
  })

  await t.test('should enable message tracer segment parameters', () => {
    assert.equal(configuration.message_tracer.segment_parameters.enabled, true)
  })

  await t.test('should not enable browser monitoring attributes', () => {
    assert.equal(configuration.browser_monitoring.attributes.enabled, false)
  })

  await t.test('should enable browser monitoring attributes', () => {
    assert.equal(configuration.browser_monitoring.attributes.enabled, false)
  })

  await t.test('should set max_payload_size_in_bytes', () => {
    assert.equal(configuration.max_payload_size_in_bytes, 1000000)
  })

  await t.test('should not enable serverless_mode', () => {
    assert.equal(configuration.serverless_mode.enabled, false)
  })

  await t.test('should default span event max_samples_stored', () => {
    assert.equal(configuration.span_events.max_samples_stored, 2000)
  })

  await t.test('should default application logging accordingly', () => {
    assert.deepStrictEqual(configuration.application_logging, {
      enabled: true,
      forwarding: {
        enabled: true,
        max_samples_stored: 10000
      },
      metrics: {
        enabled: true
      },
      local_decorating: {
        enabled: false
      }
    })
  })

  await t.test('should default `code_level_metrics.enabled` to true', () => {
    assert.equal(configuration.code_level_metrics.enabled, true)
  })

  await t.test('should default `url_obfuscation` accordingly', () => {
    assert.deepStrictEqual(configuration.url_obfuscation, {
      enabled: false,
      regex: {
        pattern: null,
        flags: '',
        replacement: ''
      }
    })
  })

  await t.test('should default security settings accordingly', () => {
    assert.deepStrictEqual(configuration.security, {
      enabled: false,
      agent: { enabled: false },
      mode: 'IAST',
      validator_service_url: 'wss://csec.nr-data.net',
      detection: {
        rci: { enabled: true },
        rxss: { enabled: true },
        deserialization: { enabled: true }
      }
    })
  })

  await t.test('should default heroku.use_dyno_names to true', () => {
    assert.equal(configuration.heroku.use_dyno_names, true)
  })

  await t.test('should default batching and compression to true for infinite tracing', () => {
    assert.equal(configuration.infinite_tracing.batching, true)
    assert.equal(configuration.infinite_tracing.compression, true)
  })

  await t.test('should default worker_threads.enabled to false', () => {
    assert.equal(configuration.worker_threads.enabled, false)
  })

  await t.test('ai_monitoring defaults', () => {
    assert.equal(configuration.ai_monitoring.enabled, false)
    assert.equal(configuration.ai_monitoring.streaming.enabled, true)
  })

  await t.test('instrumentation defaults', () => {
    assert.equal(configuration.instrumentation.express.enabled, true)
    assert.equal(configuration.instrumentation['@prisma/client'].enabled, true)
    assert.equal(configuration.instrumentation.npmlog.enabled, true)
  })
})
