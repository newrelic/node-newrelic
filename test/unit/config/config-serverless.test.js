/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const Config = require('../../../lib/config')
const { idempotentEnv } = require('./helper')

const VALID_HOST = 'infinite-tracing.test'
const VALID_PORT = '443'

tap.test('should be true when config true', (t) => {
  const conf = Config.initialize({
    serverless_mode: {
      enabled: true
    }
  })
  t.equal(conf.serverless_mode.enabled, true)
  t.end()
})

tap.test('serverless_mode via configuration input', (t) => {
  t.autoend()

  t.test('should explicitly disable cross_application_tracer', (t) => {
    const config = Config.initialize({
      cross_application_tracer: { enabled: true },
      serverless_mode: {
        enabled: true
      }
    })
    t.equal(config.cross_application_tracer.enabled, false)
    t.end()
  })

  t.test('should explicitly disable infinite tracing', (t) => {
    const config = Config.initialize({
      serverless_mode: { enabled: true },
      infinite_tracing: {
        trace_observer: {
          host: VALID_HOST,
          port: VALID_PORT
        }
      }
    })

    t.equal(config.infinite_tracing.trace_observer.host, '')
    t.end()
  })

  t.test(
    'should explicitly disable native_metrics when serverless mode disabled explicitly',
    (t) => {
      const config = Config.initialize({
        serverless_mode: {
          enabled: false
        },
        plugins: {
          native_metrics: { enabled: false }
        }
      })
      t.equal(config.plugins.native_metrics.enabled, false)
      t.end()
    }
  )

  t.test('should enable native_metrics when serverless mode disabled explicitly', (t) => {
    const config = Config.initialize({
      serverless_mode: {
        enabled: false
      }
    })
    t.equal(config.plugins.native_metrics.enabled, true)
    t.end()
  })

  t.test('should disable native_metrics when serverless mode enabled explicitly', (t) => {
    const config = Config.initialize({
      serverless_mode: {
        enabled: true
      }
    })
    t.equal(config.plugins.native_metrics.enabled, false)
    t.end()
  })

  t.test('should enable native_metrics when both enabled explicitly', (t) => {
    const config = Config.initialize({
      serverless_mode: { enabled: true },
      plugins: {
        native_metrics: { enabled: true }
      }
    })

    t.equal(config.plugins.native_metrics.enabled, true)
    t.end()
  })

  t.test('should set DT config settings while in serverless_mode', (t) => {
    const config = Config.initialize({
      account_id: '1234',
      primary_application_id: '2345',
      serverless_mode: { enabled: true }
    })

    t.equal(config.account_id, '1234')
    t.equal(config.trusted_account_key, '1234')
    t.end()
  })

  t.test('should not set DT config settings while not in serverless_mode', (t) => {
    const config = Config.initialize({
      account_id: '1234',
      primary_application_id: '2345',
      trusted_account_key: '3456'
    })

    t.equal(config.account_id, null)
    t.equal(config.primary_application_id, null)
    t.equal(config.trusted_account_key, null)

    t.end()
  })

  t.test('should default logging to disabled', (t) => {
    const config = Config.initialize({
      serverless_mode: { enabled: true }
    })

    t.equal(config.logging.enabled, false)
    t.end()
  })

  t.test('should allow logging to be enabled from configuration input', (t) => {
    const config = Config.initialize({
      serverless_mode: { enabled: true },
      logging: { enabled: true }
    })
    t.equal(config.logging.enabled, true)
    t.end()
  })

  t.test('should allow logging to be enabled from env ', (t) => {
    const inputConfig = {
      serverless_mode: { enabled: true }
    }

    const envVariables = {
      NEW_RELIC_LOG_ENABLED: true
    }

    idempotentEnv(envVariables, inputConfig, (config) => {
      t.equal(config.logging.enabled, true)
      t.end()
    })
  })
})

tap.test('serverless mode via ENV variables', (t) => {
  t.autoend()

  t.test('should pick up serverless_mode', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      },
      (tc) => {
        t.equal(tc.serverless_mode.enabled, true)
        t.end()
      }
    )
  })

  t.test('should pick up trusted_account_key', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_TRUSTED_ACCOUNT_KEY: '1234'
      },
      (tc) => {
        t.equal(tc.trusted_account_key, '1234')
        t.end()
      }
    )
  })

  t.test('should pick up primary_application_id', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_PRIMARY_APPLICATION_ID: '5678'
      },
      (tc) => {
        t.equal(tc.primary_application_id, '5678')
        t.end()
      }
    )
  })

  t.test('should pick up account_id', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '91011'
      },
      (tc) => {
        t.equal(tc.account_id, '91011')
        t.end()
      }
    )
  })

  t.test('should clear serverless_mode DT config options when serverless_mode disabled', (t) => {
    const env = {
      NEW_RELIC_TRUSTED_ACCOUNT_KEY: 'defined',
      NEW_RELIC_ACCOUNT_ID: 'defined',
      NEW_RELIC_PRIMARY_APPLICATION_ID: 'defined',
      NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: true
    }
    idempotentEnv(env, (tc) => {
      t.equal(tc.primary_application_id, null)
      t.equal(tc.account_id, null)
      t.equal(tc.trusted_account_key, null)

      t.end()
    })
  })

  t.test('should explicitly disable cross_application_tracer in serverless_mode', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      },
      (tc) => {
        t.equal(tc.serverless_mode.enabled, true)
        t.equal(tc.cross_application_tracer.enabled, false)
        t.end()
      }
    )
  })

  t.test('should allow distributed tracing to be enabled from env', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '12345'
      },
      (config) => {
        t.equal(config.distributed_tracing.enabled, true)
        t.end()
      }
    )
  })

  t.test('should allow distributed tracing to be enabled from configuration ', (t) => {
    const envVariables = {
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_ACCOUNT_ID: '12345'
    }

    const inputConfig = {
      distributed_tracing: { enabled: true }
    }

    idempotentEnv(envVariables, inputConfig, (config) => {
      t.equal(config.distributed_tracing.enabled, true)
      t.end()
    })
  })

  t.test('should enable DT in serverless_mode when account_id has been set', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '12345'
      },
      (tc) => {
        t.equal(tc.serverless_mode.enabled, true)
        t.equal(tc.distributed_tracing.enabled, true)
        t.end()
      }
    )
  })

  t.test('should not enable distributed tracing when account_id has not been set', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      },
      (tc) => {
        t.equal(tc.serverless_mode.enabled, true)
        t.equal(tc.distributed_tracing.enabled, false)
        t.end()
      }
    )
  })

  t.test('should default primary_application_id to Unknown when not set', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '12345'
      },
      (tc) => {
        t.equal(tc.serverless_mode.enabled, true)
        t.equal(tc.distributed_tracing.enabled, true)

        t.equal(tc.primary_application_id, 'Unknown')
        t.end()
      }
    )
  })

  t.test('should set serverless_mode from lambda-specific env var if not set by user', (t) => {
    idempotentEnv(
      {
        AWS_LAMBDA_FUNCTION_NAME: 'someFunc'
      },
      (tc) => {
        t.equal(tc.serverless_mode.enabled, true)
        t.end()
      }
    )
  })

  t.test('should pick app name from AWS_LAMBDA_FUNCTION_NAME', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        AWS_LAMBDA_FUNCTION_NAME: 'MyLambdaFunc'
      },
      (tc) => {
        t.ok(tc.app_name)
        t.same(tc.applications(), ['MyLambdaFunc'])
        t.end()
      }
    )
  })

  t.test('should default generic app name when no AWS_LAMBDA_FUNCTION_NAME', (t) => {
    idempotentEnv({ NEW_RELIC_SERVERLESS_MODE_ENABLED: true }, (tc) => {
      t.ok(tc.app_name)
      t.same(tc.applications(), ['Serverless Application'])

      t.end()
    })
  })

  t.test('should default logging to disabled', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      },
      (config) => {
        t.equal(config.logging.enabled, false)
        t.end()
      }
    )
  })

  t.test('should allow logging to be enabled from env', (t) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_LOG_ENABLED: true
      },
      (config) => {
        t.equal(config.logging.enabled, true)
        t.end()
      }
    )
  })

  t.test('should allow logging to be enabled from configuration ', (t) => {
    const envVariables = {
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true
    }

    const inputConfig = {
      logging: { enabled: true }
    }

    idempotentEnv(envVariables, inputConfig, (config) => {
      t.equal(config.logging.enabled, true)
      t.end()
    })
  })

  t.test('should enable native_metrics via env variable', (t) => {
    const envVariables = {
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_NATIVE_METRICS_ENABLED: true
    }

    const inputConfig = {
      plugins: {
        native_metrics: {
          enabled: false
        }
      }
    }

    idempotentEnv(envVariables, inputConfig, (config) => {
      t.equal(config.plugins.native_metrics.enabled, true)
      t.end()
    })
  })
})

tap.test('when distributed_tracing manually set in serverless_mode', (t) => {
  t.autoend()

  t.test('disables DT if missing required account_id', (t) => {
    const config = Config.initialize({
      distributed_tracing: { enabled: true },
      serverless_mode: {
        enabled: true
      },
      account_id: null
    })
    t.equal(config.distributed_tracing.enabled, false)
    t.end()
  })

  t.test('disables DT when DT set to false', (t) => {
    const config = Config.initialize({
      distributed_tracing: { enabled: false },
      serverless_mode: {
        enabled: true
      }
    })
    t.equal(config.distributed_tracing.enabled, false)
    t.end()
  })

  t.test('disables DT when DT set to false and account_id is set', (t) => {
    const config = Config.initialize({
      account_id: '1234',
      distributed_tracing: { enabled: false },
      serverless_mode: {
        enabled: true
      }
    })
    t.equal(config.distributed_tracing.enabled, false)
    t.end()
  })

  t.test('works if all required env vars are defined', (t) => {
    const env = {
      NEW_RELIC_TRUSTED_ACCOUNT_KEY: 'defined',
      NEW_RELIC_ACCOUNT_ID: 'defined',
      NEW_RELIC_PRIMARY_APPLICATION_ID: 'defined',
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: true
    }
    t.doesNotThrow(idempotentEnv.bind(idempotentEnv, env, () => {}))
    t.end()
  })
})
