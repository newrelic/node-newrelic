/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const path = require('path')

const Config = require('../../../lib/config')

tap.test('with default properties', (t) => {
  t.autoend()

  let configuration = null

  t.beforeEach(() => {
    configuration = Config.initialize({})

    // ensure environment is clean
    delete configuration.newrelic_home
  })

  t.test('should have no application name', (t) => {
    t.same(configuration.app_name, [])
    t.end()
  })

  t.test('should return no application name', (t) => {
    t.same(configuration.applications(), [])
    t.end()
  })

  t.test('should have no application ID', (t) => {
    t.equal(configuration.application_id, null)
    t.end()
  })

  t.test('should have no license key', (t) => {
    t.equal(configuration.license_key, '')
    t.end()
  })

  t.test('should connect to the collector at collector.newrelic.com', (t) => {
    t.equal(configuration.host, 'collector.newrelic.com')
    t.end()
  })

  t.test('should connect to the collector on port 443', (t) => {
    t.equal(configuration.port, 443)
    t.end()
  })

  t.test('should have SSL enabled', (t) => {
    t.equal(configuration.ssl, true)
    t.end()
  })

  t.test('should have no security_policies_token', (t) => {
    t.equal(configuration.security_policies_token, '')
    t.end()
  })

  t.test('should have no proxy host', (t) => {
    t.equal(configuration.proxy_host, '')
    t.end()
  })

  t.test('should have no proxy port', (t) => {
    t.equal(configuration.proxy_port, '')
    t.end()
  })

  t.test('should enable the agent', (t) => {
    t.equal(configuration.agent_enabled, true)
    t.end()
  })

  t.test('should have an apdexT of 0.1', (t) => {
    t.equal(configuration.apdex_t, 0.1)
    t.end()
  })

  t.test('should have a null account_id', (t) => {
    t.equal(configuration.account_id, null)
    t.end()
  })

  t.test('should have a null primary_application_id', (t) => {
    t.equal(configuration.primary_application_id, null)
    t.end()
  })

  t.test('should have a null trusted_account_key', (t) => {
    t.equal(configuration.trusted_account_key, null)
    t.end()
  })

  t.test('should have the default excluded request attributes', (t) => {
    t.same(configuration.attributes.exclude, [])
    t.end()
  })

  t.test('should have the default attribute include setting', (t) => {
    t.equal(configuration.attributes.include_enabled, true)
    t.end()
  })

  t.test('should have the default error message redaction setting ', (t) => {
    t.equal(configuration.strip_exception_messages.enabled, false)
    t.end()
  })

  t.test('should enable transaction event attributes', (t) => {
    t.equal(configuration.transaction_events.attributes.enabled, true)
    t.end()
  })

  t.test('should log at the info level', (t) => {
    t.equal(configuration.logging.level, 'info')
    t.end()
  })

  t.test('should have a log filepath of process.cwd + newrelic_agent.log', (t) => {
    const logPath = path.join(process.cwd(), 'newrelic_agent.log')
    t.equal(configuration.logging.filepath, logPath)
    t.end()
  })

  t.test('should enable the error collector', (t) => {
    t.equal(configuration.error_collector.enabled, true)
    t.end()
  })

  t.test('should enable error collector attributes', (t) => {
    t.equal(configuration.error_collector.attributes.enabled, true)
    t.end()
  })

  t.test('should ignore status code 404', (t) => {
    t.same(configuration.error_collector.ignore_status_codes, [404])
    t.end()
  })

  t.test('should enable the transaction tracer', (t) => {
    t.equal(configuration.transaction_tracer.enabled, true)
    t.end()
  })

  t.test('should enable transaction tracer attributes', (t) => {
    t.equal(configuration.transaction_tracer.attributes.enabled, true)
    t.end()
  })

  t.test('should set the transaction tracer threshold to `apdex_f`', (t) => {
    t.equal(configuration.transaction_tracer.transaction_threshold, 'apdex_f')
    t.end()
  })

  t.test('should collect one slow transaction trace per harvest cycle', (t) => {
    t.equal(configuration.transaction_tracer.top_n, 20)
    t.end()
  })

  t.test('should obfsucate sql by default', (t) => {
    t.equal(configuration.transaction_tracer.record_sql, 'obfuscated')
    t.end()
  })

  t.test('should have an explain threshold of 500ms', (t) => {
    t.equal(configuration.transaction_tracer.explain_threshold, 500)
    t.end()
  })

  t.test('should not capture slow queries', (t) => {
    t.equal(configuration.slow_sql.enabled, false)
    t.end()
  })

  t.test('should capture a maximum of 10 slow-queries per harvest', (t) => {
    t.equal(configuration.slow_sql.max_samples, 10)
    t.end()
  })

  t.test('should have no naming rules', (t) => {
    t.equal(configuration.rules.name.length, 0)
    t.end()
  })

  t.test('should have one default ignoring rules', (t) => {
    t.equal(configuration.rules.ignore.length, 1)
    t.end()
  })

  t.test('should enforce URL backstop', (t) => {
    t.equal(configuration.enforce_backstop, true)
    t.end()
  })

  t.test('should allow passed-in config to override errors ignored', (t) => {
    configuration = Config.initialize({
      error_collector: {
        ignore_status_codes: []
      }
    })

    t.same(configuration.error_collector.ignore_status_codes, [])
    t.end()
  })

  t.test('should disable cross application tracer', (t) => {
    t.equal(configuration.cross_application_tracer.enabled, false)
    t.end()
  })

  t.test('should enable message tracer segment parameters', (t) => {
    t.equal(configuration.message_tracer.segment_parameters.enabled, true)
    t.end()
  })

  t.test('should not enable browser monitoring attributes', (t) => {
    t.equal(configuration.browser_monitoring.attributes.enabled, false)
    t.end()
  })

  t.test('should enable browser monitoring attributes', (t) => {
    t.equal(configuration.browser_monitoring.attributes.enabled, false)
    t.end()
  })

  t.test('should set max_payload_size_in_bytes', (t) => {
    t.equal(configuration.max_payload_size_in_bytes, 1000000)
    t.end()
  })

  t.test('should not enable serverless_mode', (t) => {
    t.equal(configuration.serverless_mode.enabled, false)
    t.end()
  })

  t.test('should default span event max_samples_stored', (t) => {
    t.equal(configuration.span_events.max_samples_stored, 2000)
    t.end()
  })

  t.test('should default application logging accordingly', (t) => {
    t.same(configuration.application_logging, {
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
    t.end()
  })

  t.test('should default `code_level_metrics.enabled` to true', (t) => {
    t.equal(configuration.code_level_metrics.enabled, true)
    t.end()
  })

  t.test('should default `url_obfuscation` accordingly', (t) => {
    t.same(configuration.url_obfuscation, {
      enabled: false,
      regex: {
        pattern: null,
        flags: '',
        replacement: ''
      }
    })
    t.end()
  })

  t.test('should default security settings accordingly', (t) => {
    t.same(configuration.security, {
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
    t.end()
  })

  t.test('should default heroku.use_dyno_names to true', (t) => {
    t.equal(configuration.heroku.use_dyno_names, true)
    t.end()
  })

  t.test('should default batching and compression to true for infinite tracing', (t) => {
    t.equal(configuration.infinite_tracing.batching, true)
    t.equal(configuration.infinite_tracing.compression, true)
    t.end()
  })

  t.test('should default worker_threads.enabled to false', (t) => {
    t.equal(configuration.worker_threads.enabled, false)
    t.end()
  })

  t.test('ai_monitoring defaults', (t) => {
    t.equal(configuration.ai_monitoring.enabled, false)
    t.equal(configuration.ai_monitoring.streaming.enabled, true)
    t.end()
  })
})
