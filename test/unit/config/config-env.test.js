/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const { idempotentEnv } = require('./helper')

const VALID_HOST = 'infinite-tracing.test'
const VALID_PORT = '443'
const VALID_QUEUE_SIZE = 20000 // should not be 10k which is the default

tap.test('when overriding configuration values via environment variables', (t) => {
  t.autoend()

  t.test('should pick up on infinite tracing env vars', (t) => {
    const env = {
      NEW_RELIC_INFINITE_TRACING_TRACE_OBSERVER_HOST: VALID_HOST,
      NEW_RELIC_INFINITE_TRACING_TRACE_OBSERVER_PORT: VALID_PORT,
      NEW_RELIC_INFINITE_TRACING_SPAN_EVENTS_QUEUE_SIZE: VALID_QUEUE_SIZE
    }

    idempotentEnv(env, (config) => {
      t.equal(config.infinite_tracing.trace_observer.host, VALID_HOST)
      t.equal(config.infinite_tracing.trace_observer.port, VALID_PORT)
      t.equal(config.infinite_tracing.span_events.queue_size, VALID_QUEUE_SIZE)
      t.end()
    })
  })

  t.test('should default infinite tracing port to 443', (t) => {
    const env = {
      NEW_RELIC_INFINITE_TRACING_TRACE_OBSERVER_HOST: VALID_HOST
    }

    idempotentEnv(env, (config) => {
      t.equal(config.infinite_tracing.trace_observer.port, VALID_PORT)
      t.end()
    })
  })

  t.test('should pick up the application name', (t) => {
    idempotentEnv({ NEW_RELIC_APP_NAME: 'app one,app two;and app three' }, (tc) => {
      t.ok(tc.app_name)
      t.same(tc.app_name, ['app one', 'app two', 'and app three'])
      t.end()
    })
  })

  t.test('should trim spaces from multiple application names ', (t) => {
    idempotentEnv({ NEW_RELIC_APP_NAME: 'zero,one, two,  three;   four' }, (tc) => {
      t.ok(tc.app_name)
      t.same(tc.app_name, ['zero', 'one', 'two', 'three', 'four'])
      t.end()
    })
  })

  t.test('should pick up the license key', (t) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: 'hambulance' }, (tc) => {
      t.ok(tc.license_key)
      t.equal(tc.license_key, 'hambulance')
      t.equal(tc.host, 'collector.newrelic.com')

      t.end()
    })
  })

  t.test('should trim spaces from license key', (t) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: ' license ' }, (tc) => {
      t.ok(tc.license_key)
      t.equal(tc.license_key, 'license')
      t.equal(tc.host, 'collector.newrelic.com')

      t.end()
    })
  })

  t.test('should pick up the apdex_t', (t) => {
    idempotentEnv({ NEW_RELIC_APDEX_T: '111' }, (tc) => {
      t.ok(tc.apdex_t)
      t.type(tc.apdex_t, 'number')
      t.equal(tc.apdex_t, 111)

      t.end()
    })
  })

  t.test('should pick up the collector host', (t) => {
    idempotentEnv({ NEW_RELIC_HOST: 'localhost' }, (tc) => {
      t.ok(tc.host)
      t.equal(tc.host, 'localhost')

      t.end()
    })
  })

  t.test('should parse the region off the license key', (t) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: 'eu01xxhambulance' }, (tc) => {
      t.ok(tc.host)
      t.equal(tc.host, 'collector.eu01.nr-data.net')
      t.end()
    })
  })

  t.test('should take an explicit host over the license key parsed host', (t) => {
    idempotentEnv({ NEW_RELIC_LICENSE_KEY: 'eu01xxhambulance' }, function () {
      idempotentEnv({ NEW_RELIC_HOST: 'localhost' }, (tc) => {
        t.ok(tc.host)
        t.equal(tc.host, 'localhost')

        t.end()
      })
    })
  })

  t.test('should pick up on feature flags set via environment variables', (t) => {
    const ffNamePrefix = 'NEW_RELIC_FEATURE_FLAG_'
    const awaitFeatureFlag = ffNamePrefix + 'AWAIT_SUPPORT'
    idempotentEnv({ [awaitFeatureFlag]: 'false' }, (tc) => {
      t.equal(tc.feature_flag.await_support, false)
      t.end()
    })
  })

  t.test('should pick up the collector port', (t) => {
    idempotentEnv({ NEW_RELIC_PORT: 7777 }, (tc) => {
      t.equal(tc.port, '7777')
      t.end()
    })
  })

  t.test('should pick up exception message omission settings', (t) => {
    idempotentEnv({ NEW_RELIC_STRIP_EXCEPTION_MESSAGES_ENABLED: 'please' }, (tc) => {
      t.equal(tc.strip_exception_messages.enabled, true)
      t.end()
    })
  })

  t.test('should pick up the proxy host', (t) => {
    idempotentEnv({ NEW_RELIC_PROXY_HOST: 'proxyhost' }, (tc) => {
      t.equal(tc.proxy_host, 'proxyhost')

      t.end()
    })
  })

  t.test('should pick up on Distributed Tracing env vars', (t) => {
    const env = {
      NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: 'true',
      NEW_RELIC_DISTRIBUTED_TRACING_EXCLUDE_NEWRELIC_HEADER: 'true'
    }

    idempotentEnv(env, (tc) => {
      t.equal(tc.distributed_tracing.enabled, true)
      t.equal(tc.distributed_tracing.exclude_newrelic_header, true)
      t.end()
    })
  })

  t.test('should pick up on the span events env vars', (t) => {
    const env = {
      NEW_RELIC_SPAN_EVENTS_ENABLED: true,
      NEW_RELIC_SPAN_EVENTS_ATTRIBUTES_ENABLED: true,
      NEW_RELIC_SPAN_EVENTS_ATTRIBUTES_INCLUDE: 'one,two,three',
      NEW_RELIC_SPAN_EVENTS_ATTRIBUTES_EXCLUDE: 'four,five,six',
      NEW_RELIC_SPAN_EVENTS_MAX_SAMPLES_STORED: 2000
    }
    idempotentEnv(env, (tc) => {
      t.equal(tc.span_events.enabled, true)
      t.equal(tc.span_events.attributes.enabled, true)
      t.same(tc.span_events.attributes.include, ['one', 'two', 'three'])
      t.same(tc.span_events.attributes.exclude, ['four', 'five', 'six'])
      t.equal(tc.span_events.max_samples_stored, 2000)

      t.end()
    })
  })

  t.test('should pick up on the transaction segments env vars', (t) => {
    const env = {
      NEW_RELIC_TRANSACTION_SEGMENTS_ATTRIBUTES_ENABLED: true,
      NEW_RELIC_TRANSACTION_SEGMENTS_ATTRIBUTES_INCLUDE: 'one,two,three',
      NEW_RELIC_TRANSACTION_SEGMENTS_ATTRIBUTES_EXCLUDE: 'four,five,six'
    }
    idempotentEnv(env, (tc) => {
      t.equal(tc.transaction_segments.attributes.enabled, true)
      t.same(tc.transaction_segments.attributes.include, ['one', 'two', 'three'])
      t.same(tc.transaction_segments.attributes.exclude, ['four', 'five', 'six'])

      t.end()
    })
  })

  t.test('should pick up the number of logical processors of the system', (t) => {
    idempotentEnv({ NEW_RELIC_UTILIZATION_LOGICAL_PROCESSORS: 123 }, (tc) => {
      t.equal(tc.utilization.logical_processors, '123')
      t.end()
    })
  })

  t.test('should pick up the billing hostname', (t) => {
    const env = 'NEW_RELIC_UTILIZATION_BILLING_HOSTNAME'
    idempotentEnv({ [env]: 'a test string' }, (tc) => {
      t.equal(tc.utilization.billing_hostname, 'a test string')
      t.end()
    })
  })

  t.test('should pick up the total ram of the system', (t) => {
    idempotentEnv({ NEW_RELIC_UTILIZATION_TOTAL_RAM_MIB: 123 }, (tc) => {
      t.equal(tc.utilization.total_ram_mib, '123')
      t.end()
    })
  })

  t.test('should pick up the proxy port', (t) => {
    idempotentEnv({ NEW_RELIC_PROXY_PORT: 7777 }, (tc) => {
      t.equal(tc.proxy_port, '7777')
      t.end()
    })
  })

  t.test('should pick up instance reporting', (t) => {
    const env = 'NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED'
    idempotentEnv({ [env]: false }, (tc) => {
      t.equal(tc.datastore_tracer.instance_reporting.enabled, false)
      t.end()
    })
  })

  t.test('should pick up instance database name reporting', (t) => {
    const env = 'NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED'
    idempotentEnv({ [env]: false }, (tc) => {
      t.equal(tc.datastore_tracer.database_name_reporting.enabled, false)
      t.end()
    })
  })

  t.test('should pick up the log level', (t) => {
    idempotentEnv({ NEW_RELIC_LOG_LEVEL: 'XXNOEXIST' }, function (tc) {
      t.equal(tc.logging.level, 'XXNOEXIST')
      t.end()
    })
  })

  t.test('should have log level aliases', (t) => {
    const logAliases = {
      verbose: 'trace',
      debugging: 'debug',
      warning: 'warn',
      err: 'error'
    }

    // eslint-disable-next-line guard-for-in
    for (const key in logAliases) {
      idempotentEnv({ NEW_RELIC_LOG_LEVEL: key }, (tc) => {
        t.equal(tc.logging.level, logAliases[key])
      })
    }

    t.end()
  })

  t.test('should pick up the log filepath', (t) => {
    idempotentEnv({ NEW_RELIC_LOG: '/highway/to/the/danger/zone' }, (tc) => {
      t.equal(tc.logging.filepath, '/highway/to/the/danger/zone')
      t.end()
    })
  })

  t.test('should pick up whether the agent is enabled', (t) => {
    idempotentEnv({ NEW_RELIC_ENABLED: 0 }, (tc) => {
      t.equal(tc.agent_enabled, false)
      t.end()
    })
  })

  t.test('should pick up whether to capture attributes', (t) => {
    idempotentEnv({ NEW_RELIC_ATTRIBUTES_ENABLED: 'yes' }, (tc) => {
      t.equal(tc.attributes.enabled, true)
      t.end()
    })
  })

  t.test('should pick up whether to add attribute include rules', (t) => {
    idempotentEnv({ NEW_RELIC_ATTRIBUTES_INCLUDE_ENABLED: 'yes' }, (tc) => {
      t.equal(tc.attributes.include_enabled, true)
      t.end()
    })
  })

  t.test('should pick up excluded attributes', (t) => {
    idempotentEnv({ NEW_RELIC_ATTRIBUTES_EXCLUDE: 'one,two,three' }, (tc) => {
      t.same(tc.attributes.exclude, ['one', 'two', 'three'])
      t.end()
    })
  })

  t.test('should pick up whether the error collector is enabled', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_ENABLED: 'NO' }, (tc) => {
      t.equal(tc.error_collector.enabled, false)
      t.end()
    })
  })

  t.test('should pick up whether error collector attributes are enabled', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_ATTRIBUTES_ENABLED: 'NO' }, (tc) => {
      t.equal(tc.error_collector.attributes.enabled, false)
      t.end()
    })
  })

  t.test('should pick up error collector max_event_samples_stored value', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_MAX_EVENT_SAMPLES_STORED: 20 }, (tc) => {
      t.equal(tc.error_collector.max_event_samples_stored, 20)
      t.end()
    })
  })

  t.test('should pick up which status codes are ignored', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '401,404,502' }, (tc) => {
      t.same(tc.error_collector.ignore_status_codes, [401, 404, 502])
      t.end()
    })
  })

  t.test('should pick up which status codes are ignored when using a range', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '401, 420-421, 502' }, (tc) => {
      t.same(tc.error_collector.ignore_status_codes, [401, 420, 421, 502])
      t.end()
    })
  })

  t.test('should not add codes given with invalid range', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '421-420' }, (tc) => {
      t.same(tc.error_collector.ignore_status_codes, [])
      t.end()
    })
  })

  t.test('should not add codes if given out of range', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '1 - 1776' }, (tc) => {
      t.same(tc.error_collector.ignore_status_codes, [])
      t.end()
    })
  })

  t.test('should allow negative status codes ', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: '-7' }, (tc) => {
      t.same(tc.error_collector.ignore_status_codes, [-7])
      t.end()
    })
  })

  t.test('should not add codes that parse to NaN ', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES: 'abc' }, (tc) => {
      t.same(tc.error_collector.ignore_status_codes, [])
      t.end()
    })
  })

  t.test('should pick up which status codes are expected', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '401,404,502' }, (tc) => {
      t.same(tc.error_collector.expected_status_codes, [401, 404, 502])
      t.end()
    })
  })

  t.test('should pick up which status codes are expectedd when using a range', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '401, 420-421, 502' }, (tc) => {
      t.same(tc.error_collector.expected_status_codes, [401, 420, 421, 502])
      t.end()
    })
  })

  t.test('should not add codes given with invalid range', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '421-420' }, (tc) => {
      t.same(tc.error_collector.expected_status_codes, [])
      t.end()
    })
  })

  t.test('should not add codes if given out of range', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '1 - 1776' }, (tc) => {
      t.same(tc.error_collector.expected_status_codes, [])
      t.end()
    })
  })

  t.test('should allow negative status codes ', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: '-7' }, (tc) => {
      t.same(tc.error_collector.expected_status_codes, [-7])
      t.end()
    })
  })

  t.test('should not add codes that parse to NaN ', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERROR_CODES: 'abc' }, (tc) => {
      t.same(tc.error_collector.expected_status_codes, [])
      t.end()
    })
  })

  t.test('should pick up whether the transaction tracer is enabled', (t) => {
    idempotentEnv({ NEW_RELIC_TRACER_ENABLED: false }, function (tc) {
      t.equal(tc.transaction_tracer.enabled, false)
      t.end()
    })
  })

  t.test('should pick up whether transaction tracer attributes are enabled', (t) => {
    const key = 'NEW_RELIC_TRANSACTION_TRACER_ATTRIBUTES_ENABLED'
    idempotentEnv({ [key]: false }, (tc) => {
      t.equal(tc.transaction_tracer.attributes.enabled, false)
      t.end()
    })
  })

  t.test('should pick up the transaction trace threshold', (t) => {
    idempotentEnv({ NEW_RELIC_TRACER_THRESHOLD: 0.02 }, (tc) => {
      t.equal(tc.transaction_tracer.transaction_threshold, 0.02)
      t.end()
    })
  })

  t.test('should pick up the transaction trace Top N scale', (t) => {
    idempotentEnv({ NEW_RELIC_TRACER_TOP_N: 5 }, (tc) => {
      t.equal(tc.transaction_tracer.top_n, '5')
      t.end()
    })
  })

  t.test('should pick up the transaction events env vars', (t) => {
    const env = {
      NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_ENABLED: true,
      NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_INCLUDE: 'one,two,three',
      NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_EXCLUDE: 'four,five,six',
      NEW_RELIC_TRANSACTION_EVENTS_MAX_SAMPLES_STORED: 200
    }
    idempotentEnv(env, (tc) => {
      t.equal(tc.transaction_events.attributes.enabled, true)
      t.same(tc.transaction_events.attributes.include, ['one', 'two', 'three'])
      t.same(tc.transaction_events.attributes.exclude, ['four', 'five', 'six'])
      t.equal(tc.transaction_events.max_samples_stored, 200)

      t.end()
    })
  })

  t.test('should pick up the custom insights events max samples stored env var', (t) => {
    idempotentEnv({ NEW_RELIC_CUSTOM_INSIGHTS_EVENTS_MAX_SAMPLES_STORED: 88 }, (tc) => {
      t.equal(tc.custom_insights_events.max_samples_stored, 88)
      t.end()
    })
  })

  t.test('should pick up renaming rules', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_NAMING_RULES: '{"name":"u","pattern":"^t"},{"name":"t","pattern":"^u"}'
      },
      (tc) => {
        t.same(tc.rules.name, [
          { name: 'u', pattern: '^t' },
          { name: 't', pattern: '^u' }
        ])

        t.end()
      }
    )
  })

  t.test('should pick up ignoring rules', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_IGNORING_RULES: '^/test,^/no_match,^/socket\\.io/,^/api/.*/index$'
      },
      (tc) => {
        t.same(tc.rules.ignore, ['^/test', '^/no_match', '^/socket\\.io/', '^/api/.*/index$'])

        t.end()
      }
    )
  })

  t.test('should pick up whether URL backstop has been turned off', (t) => {
    idempotentEnv({ NEW_RELIC_ENFORCE_BACKSTOP: 'f' }, (tc) => {
      t.equal(tc.enforce_backstop, false)
      t.end()
    })
  })

  t.test('should pick app name from APP_POOL_ID', (t) => {
    idempotentEnv({ APP_POOL_ID: 'Simple Azure app' }, (tc) => {
      t.same(tc.applications(), ['Simple Azure app'])
      t.end()
    })
  })

  t.test('should pick up labels', (t) => {
    idempotentEnv({ NEW_RELIC_LABELS: 'key:value;a:b;' }, (tc) => {
      t.equal(tc.labels, 'key:value;a:b;')
      t.end()
    })
  })

  t.test('should pickup record_sql', (t) => {
    idempotentEnv({ NEW_RELIC_RECORD_SQL: 'raw' }, (tc) => {
      t.equal(tc.transaction_tracer.record_sql, 'raw')
      t.end()
    })
  })

  t.test('should pickup explain_threshold', (t) => {
    idempotentEnv({ NEW_RELIC_EXPLAIN_THRESHOLD: '100' }, (tc) => {
      t.equal(tc.transaction_tracer.explain_threshold, 100)
      t.end()
    })
  })

  t.test('should pickup slow_sql.enabled', (t) => {
    idempotentEnv({ NEW_RELIC_SLOW_SQL_ENABLED: 'true' }, (tc) => {
      t.equal(tc.slow_sql.enabled, true)
      t.end()
    })
  })

  t.test('should pickup slow_sql.max_samples', (t) => {
    idempotentEnv({ NEW_RELIC_MAX_SQL_SAMPLES: '100' }, (tc) => {
      t.equal(tc.slow_sql.max_samples, 100)
      t.end()
    })
  })

  t.test('should pick up logging.enabled', (t) => {
    idempotentEnv({ NEW_RELIC_LOG_ENABLED: 'false' }, (tc) => {
      t.equal(tc.logging.enabled, false)
      t.end()
    })
  })

  t.test('should pick up message tracer segment reporting', (t) => {
    const env = 'NEW_RELIC_MESSAGE_TRACER_SEGMENT_PARAMETERS_ENABLED'
    idempotentEnv({ [env]: false }, (tc) => {
      t.equal(tc.message_tracer.segment_parameters.enabled, false)
      t.end()
    })
  })

  t.test('should pick up disabled utilization detection', (t) => {
    idempotentEnv({ NEW_RELIC_UTILIZATION_DETECT_AWS: false }, (tc) => {
      t.equal(tc.utilization.detect_aws, false)
      t.end()
    })
  })

  t.test('should reject disabling ssl', (t) => {
    idempotentEnv({ NEW_RELIC_USE_SSL: false }, (tc) => {
      t.equal(tc.ssl, true)
      t.end()
    })
  })

  t.test('should pick up ignored error classes', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERRORS: 'Error, AnotherError' }, (tc) => {
      t.same(tc.error_collector.ignore_classes, ['Error', 'AnotherError'])
      t.end()
    })
  })

  t.test('should pick up expected error classes', (t) => {
    idempotentEnv({ NEW_RELIC_ERROR_COLLECTOR_EXPECTED_ERRORS: 'QError, AnotherError' }, (tc) => {
      t.same(tc.error_collector.expected_classes, ['QError', 'AnotherError'])
      t.end()
    })
  })
})
