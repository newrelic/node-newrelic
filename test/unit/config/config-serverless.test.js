/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Config = require('../../../lib/config')
const { idempotentEnv } = require('./helper')

const VALID_HOST = 'infinite-tracing.test'
const VALID_PORT = '443'

test('should be true when config true', () => {
  const conf = Config.initialize({
    serverless_mode: {
      enabled: true
    }
  })
  assert.equal(conf.serverless_mode.enabled, true)
})

test('serverless_mode via configuration input', async (t) => {
  await t.test('should explicitly disable cross_application_tracer', () => {
    const config = Config.initialize({
      cross_application_tracer: { enabled: true },
      serverless_mode: {
        enabled: true
      }
    })
    assert.equal(config.cross_application_tracer.enabled, false)
  })

  await t.test('should explicitly disable infinite tracing', () => {
    const config = Config.initialize({
      serverless_mode: { enabled: true },
      infinite_tracing: {
        trace_observer: {
          host: VALID_HOST,
          port: VALID_PORT
        }
      }
    })

    assert.equal(config.infinite_tracing.trace_observer.host, '')
  })

  await t.test(
    'should explicitly disable native_metrics when serverless mode disabled explicitly',
    () => {
      const config = Config.initialize({
        serverless_mode: {
          enabled: false
        },
        plugins: {
          native_metrics: { enabled: false }
        }
      })
      assert.equal(config.plugins.native_metrics.enabled, false)
    }
  )

  await t.test('should enable native_metrics when serverless mode disabled explicitly', () => {
    const config = Config.initialize({
      serverless_mode: {
        enabled: false
      }
    })
    assert.equal(config.plugins.native_metrics.enabled, true)
  })

  await t.test('should disable native_metrics when serverless mode enabled explicitly', () => {
    const config = Config.initialize({
      serverless_mode: {
        enabled: true
      }
    })
    assert.equal(config.plugins.native_metrics.enabled, false)
  })

  await t.test('should enable native_metrics when both enabled explicitly', () => {
    const config = Config.initialize({
      serverless_mode: { enabled: true },
      plugins: {
        native_metrics: { enabled: true }
      }
    })

    assert.equal(config.plugins.native_metrics.enabled, true)
  })

  await t.test('should set DT config settings while in serverless_mode', () => {
    const config = Config.initialize({
      account_id: '1234',
      primary_application_id: '2345',
      serverless_mode: { enabled: true }
    })

    assert.equal(config.account_id, '1234')
    assert.equal(config.trusted_account_key, '1234')
  })

  await t.test('should not set DT config settings while not in serverless_mode', () => {
    const config = Config.initialize({
      account_id: '1234',
      primary_application_id: '2345',
      trusted_account_key: '3456'
    })

    assert.equal(config.account_id, null)
    assert.equal(config.primary_application_id, null)
    assert.equal(config.trusted_account_key, null)
  })

  await t.test('should default logging to disabled', () => {
    const config = Config.initialize({
      serverless_mode: { enabled: true }
    })

    assert.equal(config.logging.enabled, false)
  })

  await t.test('should allow logging to be enabled from configuration input', () => {
    const config = Config.initialize({
      serverless_mode: { enabled: true },
      logging: { enabled: true }
    })
    assert.equal(config.logging.enabled, true)
  })

  await t.test('should allow logging to be enabled from env ', (t, end) => {
    const inputConfig = {
      serverless_mode: { enabled: true }
    }

    const envVariables = {
      NEW_RELIC_LOG_ENABLED: true
    }

    idempotentEnv(envVariables, inputConfig, (config) => {
      assert.equal(config.logging.enabled, true)
      end()
    })
  })
})

test('serverless mode via ENV variables', async (t) => {
  await t.test('should pick up serverless_mode', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      },
      (tc) => {
        assert.equal(tc.serverless_mode.enabled, true)
        end()
      }
    )
  })

  await t.test('should pick up trusted_account_key', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_TRUSTED_ACCOUNT_KEY: '1234'
      },
      (tc) => {
        assert.equal(tc.trusted_account_key, '1234')
        end()
      }
    )
  })

  await t.test('should pick up primary_application_id', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_PRIMARY_APPLICATION_ID: '5678'
      },
      (tc) => {
        assert.equal(tc.primary_application_id, '5678')
        end()
      }
    )
  })

  await t.test('should pick up account_id', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '91011'
      },
      (tc) => {
        assert.equal(tc.account_id, '91011')
        end()
      }
    )
  })

  await t.test(
    'should clear serverless_mode DT config options when serverless_mode disabled',
    (t, end) => {
      const env = {
        NEW_RELIC_TRUSTED_ACCOUNT_KEY: 'defined',
        NEW_RELIC_ACCOUNT_ID: 'defined',
        NEW_RELIC_PRIMARY_APPLICATION_ID: 'defined',
        NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: true
      }
      idempotentEnv(env, (tc) => {
        assert.equal(tc.primary_application_id, null)
        assert.equal(tc.account_id, null)
        assert.equal(tc.trusted_account_key, null)
        end()
      })
    }
  )

  await t.test('should explicitly disable cross_application_tracer in serverless_mode', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      },
      (tc) => {
        assert.equal(tc.serverless_mode.enabled, true)
        assert.equal(tc.cross_application_tracer.enabled, false)
        end()
      }
    )
  })

  await t.test('should allow distributed tracing to be enabled from env', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '12345'
      },
      (config) => {
        assert.equal(config.distributed_tracing.enabled, true)
        end()
      }
    )
  })

  await t.test('should allow distributed tracing to be enabled from configuration ', (t, end) => {
    const envVariables = {
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_ACCOUNT_ID: '12345'
    }

    const inputConfig = {
      distributed_tracing: { enabled: true }
    }

    idempotentEnv(envVariables, inputConfig, (config) => {
      assert.equal(config.distributed_tracing.enabled, true)
      end()
    })
  })

  await t.test('should enable DT in serverless_mode when account_id has been set', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '12345'
      },
      (tc) => {
        assert.equal(tc.serverless_mode.enabled, true)
        assert.equal(tc.distributed_tracing.enabled, true)
        end()
      }
    )
  })

  await t.test('should not enable distributed tracing when account_id has not been set', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      },
      (tc) => {
        assert.equal(tc.serverless_mode.enabled, true)
        assert.equal(tc.distributed_tracing.enabled, false)
        end()
      }
    )
  })

  await t.test('should default primary_application_id to Unknown when not set', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '12345'
      },
      (tc) => {
        assert.equal(tc.serverless_mode.enabled, true)
        assert.equal(tc.distributed_tracing.enabled, true)
        assert.equal(tc.primary_application_id, 'Unknown')
        end()
      }
    )
  })

  await t.test('should set serverless_mode from lambda-specific env var if not set by user', (t, end) => {
    idempotentEnv(
      {
        AWS_LAMBDA_FUNCTION_NAME: 'someFunc'
      },
      (tc) => {
        assert.equal(tc.serverless_mode.enabled, true)
        end()
      }
    )
  })

  await t.test('should pick app name from AWS_LAMBDA_FUNCTION_NAME', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        AWS_LAMBDA_FUNCTION_NAME: 'MyLambdaFunc'
      },
      (tc) => {
        assert.ok(tc.app_name)
        assert.deepEqual(tc.applications(), ['MyLambdaFunc'])
        end()
      }
    )
  })

  await t.test('should default generic app name when no AWS_LAMBDA_FUNCTION_NAME', (t, end) => {
    idempotentEnv({ NEW_RELIC_SERVERLESS_MODE_ENABLED: true }, (tc) => {
      assert.ok(tc.app_name)
      assert.deepEqual(tc.applications(), ['Serverless Application'])
      end()
    })
  })

  await t.test('should default logging to disabled', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      },
      (config) => {
        assert.equal(config.logging.enabled, false)
        end()
      }
    )
  })

  await t.test('should allow logging to be enabled from env', (t, end) => {
    idempotentEnv(
      {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_LOG_ENABLED: true
      },
      (config) => {
        assert.equal(config.logging.enabled, true)
        end()
      }
    )
  })

  await t.test('should allow logging to be enabled from configuration ', (t,end) => {
    const envVariables = {
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true
    }

    const inputConfig = {
      logging: { enabled: true }
    }

    idempotentEnv(envVariables, inputConfig, (config) => {
      assert.equal(config.logging.enabled, true)
      end()
    })
  })

  await t.test('should enable native_metrics via env variable', (t, end) => {
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
      assert.equal(config.plugins.native_metrics.enabled, true)
      end()
    })
  })
})

test('when distributed_tracing manually set in serverless_mode', async (t) => {
  await t.test('disables DT if missing required account_id', () => {
    const config = Config.initialize({
      distributed_tracing: { enabled: true },
      serverless_mode: {
        enabled: true
      },
      account_id: null
    })
    assert.equal(config.distributed_tracing.enabled, false)
  })

  await t.test('disables DT when DT set to false', () => {
    const config = Config.initialize({
      distributed_tracing: { enabled: false },
      serverless_mode: {
        enabled: true
      }
    })
    assert.equal(config.distributed_tracing.enabled, false)
  })

  await t.test('disables DT when DT set to false and account_id is set', () => {
    const config = Config.initialize({
      account_id: '1234',
      distributed_tracing: { enabled: false },
      serverless_mode: {
        enabled: true
      }
    })
    assert.equal(config.distributed_tracing.enabled, false)
  })

  await t.test('works if all required env vars are defined', () => {
    const env = {
      NEW_RELIC_TRUSTED_ACCOUNT_KEY: 'defined',
      NEW_RELIC_ACCOUNT_ID: 'defined',
      NEW_RELIC_PRIMARY_APPLICATION_ID: 'defined',
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: true
    }
    assert.doesNotThrow(idempotentEnv.bind(idempotentEnv, env, () => {}))
  })
})
