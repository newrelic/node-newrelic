/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { idempotentEnv } = require('./helper')

const VALID_HOST = 'infinite-tracing.test'
const VALID_QUEUE_SIZE = 20000 // should not be 10k which is the default

test('when overriding configuration values via environment variables', async (t) => {
  await t.test('should pick up on infinite tracing env vars', (t, end) => {
    const env = {
      NEW_RELIC_INFINITE_TRACING_TRACE_OBSERVER_HOST: VALID_HOST,
      NEW_RELIC_INFINITE_TRACING_TRACE_OBSERVER_PORT: '500',
      NEW_RELIC_INFINITE_TRACING_SPAN_EVENTS_QUEUE_SIZE: VALID_QUEUE_SIZE,
      NEW_RELIC_INFINITE_TRACING_COMPRESSION: false,
      NEW_RELIC_INFINITE_TRACING_BATCHING: false
    }

    idempotentEnv(env, (config) => {
      assert.equal(config.infinite_tracing.trace_observer.host, VALID_HOST)
      assert.equal(config.infinite_tracing.trace_observer.port, 500)
      assert.equal(config.infinite_tracing.span_events.queue_size, VALID_QUEUE_SIZE)
      assert.equal(config.infinite_tracing.compression, false)
      assert.equal(config.infinite_tracing.batching, false)
      end()
    })
  })

  await t.test('should default infinite tracing port to 443', (t, end) => {
    const env = {
      NEW_RELIC_INFINITE_TRACING_TRACE_OBSERVER_HOST: VALID_HOST
    }

    idempotentEnv(env, (config) => {
      assert.equal(config.infinite_tracing.trace_observer.port, 443)
      end()
    })
  })

  await t.test('should pick up the application name', (t, end) => {
    idempotentEnv({ NEW_RELIC_APP_NAME: 'app one,app two;and app three' }, (tc) => {
      assert.ok(tc.app_name)
      assert.deepStrictEqual(tc.app_name, ['app one', 'app two', 'and app three'])
      end()
    })
  })

  await t.test('should trim spaces from multiple application names ', (t, end) => {
    idempotentEnv({ NEW_RELIC_APP_NAME: 'zero,one, two,  three;   four' }, (tc) => {
      assert.ok(tc.app_name)
      assert.deepStrictEqual(tc.app_name, ['zero', 'one', 'two', 'three', 'four'])
      end()
    })
  })

  await t.test('should pick up the license key', (t, end) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: 'hambulance' }, (tc) => {
      assert.ok(tc.license_key)
      assert.equal(tc.license_key, 'hambulance')
      assert.equal(tc.host, 'collector.newrelic.com')
      end()
    })
  })

  await t.test('should trim spaces from license key', (t, end) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: ' license ' }, (tc) => {
      assert.ok(tc.license_key)
      assert.equal(tc.license_key, 'license')
      assert.equal(tc.host, 'collector.newrelic.com')
      end()
    })
  })

  await t.test('should pick up the apdex_t', (t, end) => {
    idempotentEnv({ NEW_RELIC_APDEX_T: '111' }, (tc) => {
      assert.ok(tc.apdex_t)
      assert.strictEqual(typeof tc.apdex_t, 'number')
      assert.equal(tc.apdex_t, 111)
      end()
    })
  })

  await t.test('should pick up the collector host', (t, end) => {
    idempotentEnv({ NEW_RELIC_HOST: 'localhost' }, (tc) => {
      assert.ok(tc.host)
      assert.equal(tc.host, 'localhost')
      end()
    })
  })

  await t.test('should parse the region off the license key', (t, end) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: 'eu01xxhambulance' }, (tc) => {
      assert.ok(tc.host)
      assert.equal(tc.host, 'collector.eu01.nr-data.net')
      end()
    })
  })

  await t.test('should take an explicit host over the license key parsed host', (t, end) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: 'eu01xxhambulance' }, function () {
      idempotentEnv({ NEW_RELIC_HOST: 'localhost' }, (tc) => {
        assert.ok(tc.host)
        assert.equal(tc.host, 'localhost')
        end()
      })
    })
  })

  await t.test('should default OTel host if nothing to parse in the license key', (t, end) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: 'hambulance' }, (tc) => {
      assert.ok(tc.otlp_endpoint)
      assert.equal(tc.otlp_endpoint, 'otlp.nr-data.net')
      end()
    })
  })

  await t.test('should parse the region off the license key for OTel', (t, end) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: 'eu01xxhambulance' }, (tc) => {
      assert.ok(tc.otlp_endpoint)
      assert.equal(tc.otlp_endpoint, 'otlp.eu01.nr-data.net')
      end()
    })
  })

  await t.test(
    'should take an explicit OTel endpoint over the license key parsed host',
    (t, end) => {
      idempotentEnv({ NEW_RELIC_LICENSE_KEY: 'eu01xxhambulance' }, function () {
        idempotentEnv({ NEW_RELIC_OTLP_ENDPOINT: 'localhost' }, (tc) => {
          assert.ok(tc.otlp_endpoint)
          assert.equal(tc.otlp_endpoint, 'localhost')
          end()
        })
      })
    }
  )

  await t.test('should pick up on feature flags set via environment variables', (t, end) => {
    const ffNamePrefix = 'NEW_RELIC_FEATURE_FLAG_'
    const awaitFeatureFlag = ffNamePrefix + 'AWAIT_SUPPORT'
    idempotentEnv({ [awaitFeatureFlag]: 'false' }, (tc) => {
      assert.equal(tc.feature_flag.await_support, false)
      end()
    })
  })

  await t.test('should pick up the collector port', (t, end) => {
    idempotentEnv({ NEW_RELIC_PORT: '7777' }, (tc) => {
      assert.equal(tc.port, 7777)
      end()
    })
  })

  await t.test('should pick up exception message omission settings', (t, end) => {
    idempotentEnv({ NEW_RELIC_STRIP_EXCEPTION_MESSAGES_ENABLED: 'please' }, (tc) => {
      assert.equal(tc.strip_exception_messages.enabled, true)
      end()
    })
  })

  await t.test('should pick up the proxy host', (t, end) => {
    idempotentEnv({ NEW_RELIC_PROXY_HOST: 'proxyhost' }, (tc) => {
      assert.equal(tc.proxy_host, 'proxyhost')
      end()
    })
  })

  await t.test('should pick up on Distributed Tracing env vars', (t, end) => {
    const env = {
      NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: 'true',
      NEW_RELIC_DISTRIBUTED_TRACING_EXCLUDE_NEWRELIC_HEADER: 'true'
    }

    idempotentEnv(env, (tc) => {
      assert.equal(tc.distributed_tracing.enabled, true)
      assert.equal(tc.distributed_tracing.exclude_newrelic_header, true)
      end()
    })
  })

  await t.test('should pick up on the span events env vars', (t, end) => {
    const env = {
      NEW_RELIC_SPAN_EVENTS_ENABLED: true,
      NEW_RELIC_SPAN_EVENTS_ATTRIBUTES_ENABLED: true,
      NEW_RELIC_SPAN_EVENTS_ATTRIBUTES_INCLUDE: 'one,two,three',
      NEW_RELIC_SPAN_EVENTS_ATTRIBUTES_EXCLUDE: 'four,five,six',
      NEW_RELIC_SPAN_EVENTS_MAX_SAMPLES_STORED: 2000
    }
    idempotentEnv(env, (tc) => {
      assert.equal(tc.span_events.enabled, true)
      assert.equal(tc.span_events.attributes.enabled, true)
      assert.deepStrictEqual(tc.span_events.attributes.include, ['one', 'two', 'three'])
      assert.deepStrictEqual(tc.span_events.attributes.exclude, ['four', 'five', 'six'])
      assert.equal(tc.span_events.max_samples_stored, 2000)
      end()
    })
  })

  await t.test('should pick up on the transaction segments env vars', (t, end) => {
    const env = {
      NEW_RELIC_TRANSACTION_SEGMENTS_ATTRIBUTES_ENABLED: true,
      NEW_RELIC_TRANSACTION_SEGMENTS_ATTRIBUTES_INCLUDE: 'one,two,three',
      NEW_RELIC_TRANSACTION_SEGMENTS_ATTRIBUTES_EXCLUDE: 'four,five,six'
    }
    idempotentEnv(env, (tc) => {
      assert.equal(tc.transaction_segments.attributes.enabled, true)
      assert.deepStrictEqual(tc.transaction_segments.attributes.include, ['one', 'two', 'three'])
      assert.deepStrictEqual(tc.transaction_segments.attributes.exclude, ['four', 'five', 'six'])
      end()
    })
  })

  await t.test('should pick up the number of logical processors of the system', (t, end) => {
    idempotentEnv({ NEW_RELIC_UTILIZATION_LOGICAL_PROCESSORS: '123' }, (tc) => {
      assert.equal(tc.utilization.logical_processors, 123)
      end()
    })
  })

  await t.test('should pick up the billing hostname', (t, end) => {
    const env = 'NEW_RELIC_UTILIZATION_BILLING_HOSTNAME'
    idempotentEnv({ [env]: 'a test string' }, (tc) => {
      assert.equal(tc.utilization.billing_hostname, 'a test string')
      end()
    })
  })

  await t.test('should pick up the total ram of the system', (t, end) => {
    idempotentEnv({ NEW_RELIC_UTILIZATION_TOTAL_RAM_MIB: '123' }, (tc) => {
      assert.equal(tc.utilization.total_ram_mib, 123)
      end()
    })
  })

  await t.test('should pick up the proxy port', (t, end) => {
    idempotentEnv({ NEW_RELIC_PROXY_PORT: 7777 }, (tc) => {
      assert.equal(tc.proxy_port, '7777')
      end()
    })
  })

  await t.test('should pick up instance reporting', (t, end) => {
    const env = 'NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED'
    idempotentEnv({ [env]: false }, (tc) => {
      assert.equal(tc.datastore_tracer.instance_reporting.enabled, false)
      end()
    })
  })

  await t.test('should pick up instance database name reporting', (t, end) => {
    const env = 'NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED'
    idempotentEnv({ [env]: false }, (tc) => {
      assert.equal(tc.datastore_tracer.database_name_reporting.enabled, false)
      end()
    })
  })

  await t.test('should pick up the log level', (t, end) => {
    idempotentEnv({ NEW_RELIC_LOG_LEVEL: 'XXNOEXIST' }, function (tc) {
      assert.equal(tc.logging.level, 'XXNOEXIST')
      end()
    })
  })

  await t.test('should have log level aliases', (t, end) => {
    const logAliases = {
      verbose: 'trace',
      debugging: 'debug',
      warning: 'warn',
      err: 'error'
    }

    // eslint-disable-next-line guard-for-in
    for (const key in logAliases) {
      idempotentEnv({ NEW_RELIC_LOG_LEVEL: key }, (tc) => {
        assert.equal(tc.logging.level, logAliases[key])
      })
    }

    end()
  })

  await t.test('should pick up the log filepath', (t, end) => {
    idempotentEnv({ NEW_RELIC_LOG: '/highway/to/the/danger/zone' }, (tc) => {
      assert.equal(tc.logging.filepath, '/highway/to/the/danger/zone')
      end()
    })
  })

  await t.test('should pick up whether the agent is enabled', (t, end) => {
    idempotentEnv({ NEW_RELIC_ENABLED: 0 }, (tc) => {
      assert.equal(tc.agent_enabled, false)
      end()
    })
  })

  await t.test('should pick up whether to capture attributes', (t, end) => {
    idempotentEnv({ NEW_RELIC_ATTRIBUTES_ENABLED: 'yes' }, (tc) => {
      assert.equal(tc.attributes.enabled, true)
      end()
    })
  })

  await t.test('should pick up whether to add attribute include rules', (t, end) => {
    idempotentEnv({ NEW_RELIC_ATTRIBUTES_INCLUDE_ENABLED: 'yes' }, (tc) => {
      assert.equal(tc.attributes.include_enabled, true)
      end()
    })
  })

  await t.test('should pick up excluded attributes', (t, end) => {
    idempotentEnv({ NEW_RELIC_ATTRIBUTES_EXCLUDE: 'one,two,three' }, (tc) => {
      assert.deepStrictEqual(tc.attributes.exclude, ['one', 'two', 'three'])
      end()
    })
  })

  await t.test('should pick up whether the error collector is enabled', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_ENABLED: 'NO' }, (tc) => {
      assert.equal(tc.error_collector.enabled, false)
      end()
    })
  })

  await t.test('should pick up whether error collector attributes are enabled', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_ATTRIBUTES_ENABLED: 'NO' }, (tc) => {
      assert.equal(tc.error_collector.attributes.enabled, false)
      end()
    })
  })

  await t.test('should pick up error collector max_event_samples_stored value', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_MAX_EVENT_SAMPLES_STORED: 20 }, (tc) => {
      assert.equal(tc.error_collector.max_event_samples_stored, 20)
      end()
    })
  })

  await t.test('should pick up which status codes are ignored', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '401,404,502' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.ignore_status_codes, [401, 404, 502])
      end()
    })
  })

  await t.test('should pick up which status codes are ignored when using a range', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '401, 420-421, 502' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.ignore_status_codes, [401, 420, 421, 502])
      end()
    })
  })

  await t.test('should not add codes given with invalid range', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '421-420' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.ignore_status_codes, [])
      end()
    })
  })

  await t.test('should not add codes if given out of range', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '1 - 1776' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.ignore_status_codes, [])
      end()
    })
  })

  await t.test('should allow negative status codes ', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '-7' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.ignore_status_codes, [-7])
      end()
    })
  })

  await t.test('should not add codes that parse to NaN ', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: 'abc' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.ignore_status_codes, [])
      end()
    })
  })

  await t.test('should pick up which status codes are expected', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '401,404,502' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.expected_status_codes, [401, 404, 502])
      end()
    })
  })

  await t.test('should pick up which status codes are expectedd when using a range', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '401, 420-421, 502'
      },
      (tc) => {
        assert.deepStrictEqual(tc.error_collector.expected_status_codes, [401, 420, 421, 502])
        end()
      }
    )
  })

  await t.test('should not add codes given with invalid range', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '421-420' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.expected_status_codes, [])
      end()
    })
  })

  await t.test('should not add codes if given out of range', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '1 - 1776' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.expected_status_codes, [])
      end()
    })
  })

  await t.test('should allow negative status codes ', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '-7' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.expected_status_codes, [-7])
      end()
    })
  })

  await t.test('should not add codes that parse to NaN ', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: 'abc' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.expected_status_codes, [])
      end()
    })
  })

  await t.test('should pick up whether the transaction tracer is enabled', (t, end) => {
    idempotentEnv({ NEW_RELIC_TRACER_ENABLED: false }, function (tc) {
      assert.equal(tc.transaction_tracer.enabled, false)
      end()
    })
  })

  await t.test('should pick up whether transaction tracer attributes are enabled', (t, end) => {
    const key = 'NEW_RELIC_TRANSACTION_TRACER_ATTRIBUTES_ENABLED'
    idempotentEnv({ [key]: false }, (tc) => {
      assert.equal(tc.transaction_tracer.attributes.enabled, false)
      end()
    })
  })

  await t.test('should pick up the transaction trace threshold', (t, end) => {
    idempotentEnv({ NEW_RELIC_TRACER_THRESHOLD: 0.02 }, (tc) => {
      assert.equal(tc.transaction_tracer.transaction_threshold, 0.02)
      end()
    })
  })

  await t.test('should pick up the transaction trace Top N scale', (t, end) => {
    idempotentEnv({ NEW_RELIC_TRACER_TOP_N: '5' }, (tc) => {
      assert.equal(tc.transaction_tracer.top_n, 5)
      end()
    })
  })

  await t.test('should pick up the transaction events env vars', (t, end) => {
    const env = {
      NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_ENABLED: true,
      NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_INCLUDE: 'one,two,three',
      NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_EXCLUDE: 'four,five,six',
      NEW_RELIC_TRANSACTION_EVENTS_MAX_SAMPLES_STORED: 200
    }
    idempotentEnv(env, (tc) => {
      assert.equal(tc.transaction_events.attributes.enabled, true)
      assert.deepStrictEqual(tc.transaction_events.attributes.include, ['one', 'two', 'three'])
      assert.deepStrictEqual(tc.transaction_events.attributes.exclude, ['four', 'five', 'six'])
      assert.equal(tc.transaction_events.max_samples_stored, 200)
      end()
    })
  })

  await t.test('should pick up the custom insights events max samples stored env var', (t, end) => {
    idempotentEnv({ NEW_RELIC_CUSTOM_INSIGHTS_EVENTS_MAX_SAMPLES_STORED: 88 }, (tc) => {
      assert.equal(tc.custom_insights_events.max_samples_stored, 88)
      end()
    })
  })

  await t.test('should pick up renaming rules', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_NAMING_RULES: '{"name":"u","pattern":"^t"},{"name":"t","pattern":"^u"}'
      },
      (tc) => {
        assert.deepStrictEqual(tc.rules.name, [
          { name: 'u', pattern: '^t' },
          { name: 't', pattern: '^u' }
        ])
        end()
      }
    )
  })

  await t.test('should pick up ignoring rules', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_IGNORING_RULES: '^/test,^/no_match,^/socket\\.io/,^/api/.*/index$'
      },
      (tc) => {
        assert.deepStrictEqual(tc.rules.ignore, [
          '^/test',
          '^/no_match',
          '^/socket\\.io/',
          '^/api/.*/index$'
        ])
        end()
      }
    )
  })

  await t.test('should pick up whether URL backstop has been turned off', (t, end) => {
    idempotentEnv({ NEW_RELIC_ENFORCE_BACKSTOP: 'f' }, (tc) => {
      assert.equal(tc.enforce_backstop, false)
      end()
    })
  })

  await t.test('should pick app name from APP_POOL_ID', (t, end) => {
    idempotentEnv({ APP_POOL_ID: 'Simple Azure app' }, (tc) => {
      assert.deepStrictEqual(tc.applications(), ['Simple Azure app'])
      end()
    })
  })

  // NOTE: the conversion is done in lib/collector/facts.js
  await t.test('should pick up labels', (t, end) => {
    idempotentEnv({ NEW_RELIC_LABELS: 'key:value;a:b;' }, (tc) => {
      assert.equal(tc.labels, 'key:value;a:b;')
      end()
    })
  })

  const values = ['off', 'obfuscated', 'raw', 'invalid']
  for (const val of values) {
    const expectedValue = val === 'invalid' ? 'off' : val
    await t.test(`should pickup record_sql value of ${expectedValue}`, (t, end) => {
      idempotentEnv({ NEW_RELIC_RECORD_SQL: val }, (tc) => {
        assert.equal(tc.transaction_tracer.record_sql, expectedValue)
        end()
      })
    })
  }

  await t.test('should pickup explain_threshold', (t, end) => {
    idempotentEnv({ NEW_RELIC_EXPLAIN_THRESHOLD: '100' }, (tc) => {
      assert.equal(tc.transaction_tracer.explain_threshold, 100)
      end()
    })
  })

  await t.test('should pickup slow_sql.enabled', (t, end) => {
    idempotentEnv({ NEW_RELIC_SLOW_SQL_ENABLED: 'true' }, (tc) => {
      assert.equal(tc.slow_sql.enabled, true)
      end()
    })
  })

  await t.test('should pickup slow_sql.max_samples', (t, end) => {
    idempotentEnv({ NEW_RELIC_MAX_SQL_SAMPLES: '100' }, (tc) => {
      assert.equal(tc.slow_sql.max_samples, 100)
      end()
    })
  })

  await t.test('should pick up logging.enabled', (t, end) => {
    idempotentEnv({ NEW_RELIC_LOG_ENABLED: 'false' }, (tc) => {
      assert.equal(tc.logging.enabled, false)
      end()
    })
  })

  await t.test('should pick up message tracer segment reporting', (t, end) => {
    const env = 'NEW_RELIC_MESSAGE_TRACER_SEGMENT_PARAMETERS_ENABLED'
    idempotentEnv({ [env]: false }, (tc) => {
      assert.equal(tc.message_tracer.segment_parameters.enabled, false)
      end()
    })
  })

  await t.test('should pick up disabled utilization detection', (t, end) => {
    idempotentEnv({ NEW_RELIC_UTILIZATION_DETECT_AWS: false }, (tc) => {
      assert.equal(tc.utilization.detect_aws, false)
      end()
    })
  })

  await t.test('should pick up cloud aws account_id', (t, end) => {
    idempotentEnv({ NEW_RELIC_CLOUD_AWS_ACCOUNT_ID: '123456789123' }, (tc) => {
      assert.equal(tc.cloud.aws.account_id, 123456789123)
      end()
    })
  })

  await t.test('should reject disabling ssl', (t, end) => {
    idempotentEnv({ NEW_RELIC_USE_SSL: false }, (tc) => {
      assert.equal(tc.ssl, true)
      end()
    })
  })

  await t.test('should pick up ignored error classes', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERRORS: 'Error, AnotherError' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.ignore_classes, ['Error', 'AnotherError'])
      end()
    })
  })

  await t.test('should pick up expected error classes', (t, end) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERRORS: 'QError, AnotherError' }, (tc) => {
      assert.deepStrictEqual(tc.error_collector.expected_classes, ['QError', 'AnotherError'])
      end()
    })
  })

  await t.test('should pick up all_all_headers', (t, end) => {
    idempotentEnv({ NEW_RELIC_ALLOW_ALL_HEADERS: 'true' }, function (tc) {
      assert.equal(tc.allow_all_headers, true)
      end()
    })
  })

  await t.test('should pick up application logging values', (t, end) => {
    const config = {
      NEW_RELIC_APPLICATION_LOGGING_ENABLED: 'true',
      NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED: 'true',
      NEW_RELIC_APPLICATION_LOGGING_FORWARDING_MAX_SAMPLES_STORED: '12345',
      NEW_RELIC_APPLICATION_LOGGING_METRICS_ENABLED: 'false',
      NEW_RELIC_APPLICATION_LOGGING_LOCAL_DECORATING_ENABLED: 'true'
    }
    idempotentEnv(config, function (tc) {
      assert.deepStrictEqual(tc.application_logging, {
        enabled: true,
        forwarding: {
          enabled: true,
          max_samples_stored: 12345
        },
        metrics: {
          enabled: false
        },
        local_decorating: {
          enabled: true
        }
      })
      end()
    })
  })

  await t.test('should pick up ignore_server_configuration', (t, end) => {
    idempotentEnv({ NEW_RELIC_IGNORE_SERVER_SIDE_CONFIG: 'true' }, function (tc) {
      assert.equal(tc.ignore_server_configuration, true)
      end()
    })
  })

  const ipvValues = ['4', '6', 'bogus']
  for (const val of ipvValues) {
    const expectedValue = val === 'bogus' ? '4' : val
    await t.test(`should pick up ipv_preference of ${expectedValue}`, (t, end) => {
      idempotentEnv({ NEW_RELIC_IPV_PREFERENCE: val }, function (tc) {
        assert.equal(tc.process_host.ipv_preference, expectedValue)
        end()
      })
    })

    await t.test('should pick up error_collector.ignore_messages', (t, end) => {
      const config = { Error: ['On no'] }
      idempotentEnv(
        { NEW_RELIC_ERROR_COLLECTOR_IGNORE_MESSAGES: JSON.stringify(config) },
        function (tc) {
          assert.deepStrictEqual(tc.error_collector.ignore_messages, config)
          end()
        }
      )
    })

    await t.test('should pick up code_level_metrics.enabled', (t, end) => {
      idempotentEnv({ NEW_RELIC_CODE_LEVEL_METRICS_ENABLED: 'true' }, function (tc) {
        assert.equal(tc.code_level_metrics.enabled, true)
        end()
      })
    })

    await t.test('should pick up url_obfuscation.enabled', (t, end) => {
      const env = {
        NEW_RELIC_URL_OBFUSCATION_ENABLED: 'true'
      }

      idempotentEnv(env, (config) => {
        assert.equal(config.url_obfuscation.enabled, true)
        end()
      })
    })

    await t.test('should pick up url_obfuscation.regex parameters', (t, end) => {
      const env = {
        NEW_RELIC_URL_OBFUSCATION_REGEX_PATTERN: 'regex',
        NEW_RELIC_URL_OBFUSCATION_REGEX_FLAGS: 'g',
        NEW_RELIC_URL_OBFUSCATION_REGEX_REPLACEMENT: 'replacement'
      }

      idempotentEnv(env, (config) => {
        assert.deepStrictEqual(config.url_obfuscation.regex.pattern, /regex/)
        assert.equal(config.url_obfuscation.regex.flags, 'g')
        assert.equal(config.url_obfuscation.regex.replacement, 'replacement')
        end()
      })
    })

    await t.test('should set regex to undefined if invalid regex', (t, end) => {
      const env = {
        NEW_RELIC_URL_OBFUSCATION_REGEX_PATTERN: '['
      }

      idempotentEnv(env, (config) => {
        assert.ok(!config.url_obfuscation.regex.pattern)
        end()
      })
    })

    await t.test('should convert NEW_RELIC_GRPC_IGNORE_STATUS_CODES to integers', (t, end) => {
      const env = {
        NEW_RELIC_GRPC_IGNORE_STATUS_CODES: '5-7,blah,9'
      }

      idempotentEnv(env, (config) => {
        assert.deepStrictEqual(config.grpc.ignore_status_codes, [5, 6, 7, 9])
        end()
      })
    })

    await t.test('should convert security env vars accordingly', (t, end) => {
      const env = {
        NEW_RELIC_SECURITY_ENABLED: true,
        NEW_RELIC_SECURITY_AGENT_ENABLED: true,
        NEW_RELIC_SECURITY_MODE: 'RASP',
        NEW_RELIC_SECURITY_VALIDATOR_SERVICE_URL: 'new-url',
        NEW_RELIC_SECURITY_DETECTION_RCI_ENABLED: false,
        NEW_RELIC_SECURITY_DETECTION_RXSS_ENABLED: false,
        NEW_RELIC_SECURITY_DETECTION_DESERIALIZATION_ENABLED: false,
        NEW_RELIC_SECURITY_IAST_TEST_IDENTIFIER: 'test_id',
        NEW_RELIC_SECURITY_SCAN_CONTROLLERS_IAST_SCAN_REQUEST_RATE_LIMIT: 3600,
        NEW_RELIC_SECURITY_SCAN_CONTROLLERS_SCAN_INSTANCE_COUNT: 1,
        NEW_RELIC_SECURITY_SCAN_SCHEDULE_DELAY: 0,
        NEW_RELIC_SECURITY_SCAN_SCHEDULE_DURATION: 300,
        NEW_RELIC_SECURITY_SCAN_SCHEDULE_SCHEDULE: '',
        NEW_RELIC_SECURITY_SCAN_SCHEDULE_ALWAYS_SAMPLE_TRACES: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_API: 'foo',
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_HTTP_REQUEST_PARAMETERS_HEADER:
          'header1, header2',
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_HTTP_REQUEST_PARAMETERS_QUERY: 'q1, q2',
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_HTTP_REQUEST_PARAMETERS_BODY: 'a1',
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_INSECURE_SETTINGS: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_INVALID_FILE_ACCESS: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_SQL_INJECTION: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_NOSQL_INJECTION: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_LDAP_INJECTION: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_JAVASCRIPT_INJECTION: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_COMMAND_INJECTION: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_XPATH_INJECTION: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_SSRF: false,
        NEW_RELIC_SECURITY_EXCLUDE_FROM_IAST_SCAN_IAST_DETECTION_CATEGORY_RXSS: false
      }
      idempotentEnv(env, (config) => {
        assert.deepStrictEqual(config.security, {
          enabled: true,
          agent: { enabled: true },
          mode: 'RASP',
          validator_service_url: 'new-url',
          detection: {
            rci: { enabled: false },
            rxss: { enabled: false },
            deserialization: { enabled: false }
          },
          iast_test_identifier: 'test_id',
          scan_controllers: {
            iast_scan_request_rate_limit: 3600,
            scan_instance_count: 1
          },
          scan_schedule: {
            delay: 0,
            duration: 300,
            schedule: '',
            always_sample_traces: false
          },
          exclude_from_iast_scan: {
            api: ['foo'],
            http_request_parameters: {
              header: ['header1', 'header2'],
              query: ['q1', 'q2'],
              body: ['a1']
            },
            iast_detection_category: {
              insecure_settings: false,
              invalid_file_access: false,
              sql_injection: false,
              nosql_injection: false,
              ldap_injection: false,
              javascript_injection: false,
              command_injection: false,
              xpath_injection: false,
              ssrf: false,
              rxss: false
            }
          }
        })
        end()
      })
    })

    await t.test('should convert NEW_RELIC_HEROKU_USE_DYNO_NAMES accordingly', (t, end) => {
      idempotentEnv({ NEW_RELIC_HEROKU_USE_DYNO_NAMES: 'false' }, (config) => {
        assert.equal(config.heroku.use_dyno_names, false)
        end()
      })
    })

    await t.test('should convert NEW_RELIC_WORKER_THREADS_ENABLED accordingly', (t, end) => {
      idempotentEnv({ NEW_RELIC_WORKER_THREADS_ENABLED: 'true' }, (config) => {
        assert.equal(config.worker_threads.enabled, true)
        end()
      })
    })

    await t.test('should convert NEW_RELIC_INSTRUMENTATION*  accordingly', (t, end) => {
      const env = {
        NEW_RELIC_INSTRUMENTATION_IOREDIS_ENABLED: 'false',
        ['NEW_RELIC_INSTRUMENTATION_@GRPC/GRPC-JS_ENABLED']: 'false',
        NEW_RELIC_INSTRUMENTATION_KNEX_ENABLED: 'false'
      }
      idempotentEnv(env, (config) => {
        assert.equal(config.instrumentation.ioredis.enabled, false)
        assert.equal(config.instrumentation['@grpc/grpc-js'].enabled, false)
        assert.equal(config.instrumentation.knex.enabled, false)
        end()
      })
    })
  }
})
