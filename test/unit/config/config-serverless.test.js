/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
tap.mochaGlobals()

const chai = require('chai')
const expect = chai.expect
const Config = require('../../../lib/config')
const {idempotentEnv} = require('./helper')

const VALID_HOST = 'infinite-tracing.test'
const VALID_PORT = '443'

describe('when loading from a file', () => {
  describe('serverless mode', () => {
    it('should be true when config true', () => {
      const conf = Config.initialize({
        serverless_mode: {
          enabled: true
        }
      })
      expect(conf.serverless_mode.enabled).to.be.true
    })
  })
})

describe('when distributed_tracing manually set in serverless_mode', () => {
  it('disables DT if missing required account_id', () => {
    const config = Config.initialize({
      distributed_tracing: {enabled: true},
      serverless_mode: {
        enabled: true
      },
      account_id: null
    })
    expect(config.distributed_tracing.enabled).to.be.false
  })

  it('disables DT when DT set to false', () => {
    const config = Config.initialize({
      distributed_tracing: {enabled: false},
      serverless_mode: {
        enabled: true
      },
    })
    expect(config.distributed_tracing.enabled).to.be.false
  })

  it('disables DT when DT set to false and account_id is set', () => {
    const config = Config.initialize({
      account_id: '1234',
      distributed_tracing: {enabled: false},
      serverless_mode: {
        enabled: true
      },
    })
    expect(config.distributed_tracing.enabled).to.be.false
  })

  it('works if all required env vars are defined', () => {
    const env = {
      NEW_RELIC_TRUSTED_ACCOUNT_KEY: 'defined',
      NEW_RELIC_ACCOUNT_ID: 'defined',
      NEW_RELIC_PRIMARY_APPLICATION_ID: 'defined',
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: true
    }
    expect(idempotentEnv.bind(idempotentEnv, env, () => {})).to.not.throw()
  })
})

describe('with serverless_mode disabled', () => {
  it('should clear serverless_mode dt config options', () => {
    const env = {
      NEW_RELIC_TRUSTED_ACCOUNT_KEY: 'defined',
      NEW_RELIC_ACCOUNT_ID: 'defined',
      NEW_RELIC_PRIMARY_APPLICATION_ID: 'defined',
      NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: true
    }
    idempotentEnv(env, (tc) => {
      expect(tc.primary_application_id).to.equal(null)
      expect(tc.account_id).to.equal(null)
      expect(tc.trusted_account_key).to.equal(null)
    })
  })
})

describe('with serverless_mode enabled', () => {
  it('should explicitly disable cross_application_tracer', () => {
    const config = Config.initialize({
      cross_application_tracer: {enabled: true},
      serverless_mode: {
        enabled: true
      }
    })
    expect(config.cross_application_tracer.enabled).to.be.false
  })

  it('should explicitly disable infinite tracing', () => {
    const config = Config.initialize({
      serverless_mode: { enabled: true },
      infinite_tracing: { trace_observer: {
        host: VALID_HOST,
        port: VALID_PORT
      }}
    })

    expect(config.infinite_tracing.trace_observer.host).to.equal('')
  })

  it('should pick up trusted_account_key', () => {
    idempotentEnv({
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_TRUSTED_ACCOUNT_KEY: '1234'
    }, (tc) => {
      expect(tc.trusted_account_key).to.equal('1234')
    })
  })

  it('should pick up primary_application_id', () => {
    idempotentEnv({
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_PRIMARY_APPLICATION_ID: '5678'
    }, (tc) => {
      expect(tc.primary_application_id).to.equal('5678')
    })
  })

  it('should pick up account_id', () => {
    idempotentEnv({
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_ACCOUNT_ID: '91011'
    }, (tc) => {
      expect(tc.account_id).to.equal('91011')
    })
  })

  it('should explicitly disable native_metrics when ' +
    'serverless mode disabled explicitly', () => {
    const config = Config.initialize({
      serverless_mode: {
        enabled: false
      },
      plugins: {
        native_metrics: {enabled: false}
      }
    })
    expect(config.plugins.native_metrics.enabled).to.be.false
  })

  it('should enable native_metrics when ' +
    'serverless mode disabled explicitly', () => {
    const config = Config.initialize({
      serverless_mode: {
        enabled: false
      }
    })
    expect(config.plugins.native_metrics.enabled).to.be.true
  })

  it('should disable native_metrics when ' +
  'serverless mode enabled explicitly', () => {
    const config = Config.initialize({
      serverless_mode: {
        enabled: true
      }
    })
    expect(config.plugins.native_metrics.enabled).to.be.false
  })

  describe('via configuration input', () => {
    it('should set DT config settings while in serverless_mode', () => {
      const config = Config.initialize({
        account_id: '1234',
        primary_application_id: '2345',
        serverless_mode: {enabled: true}
      })

      expect(config.account_id).to.equal('1234')
      expect(config.trusted_account_key).to.equal('1234')
    })

    it('should not set DT config settings while not in serverless_mode', () => {
      const config = Config.initialize({
        account_id: '1234',
        primary_application_id: '2345',
        trusted_account_key: '3456',
      })

      expect(config.account_id).to.be.null
      expect(config.primary_application_id).to.be.null
      expect(config.trusted_account_key).to.be.null
    })

    it('should enable native_metrics via config', () => {
      const config = Config.initialize({
        serverless_mode: {enabled: true},
        plugins: {
          native_metrics: {enabled: true}
        }
      })

      expect(config.plugins.native_metrics.enabled).to.be.true
    })

    it('should default logging to disabled', () => {
      const config = Config.initialize({
        serverless_mode: {enabled: true}
      })

      expect(config.logging.enabled).to.be.false
    })

    it('should allow logging to be enabled from configuration input', () => {
      const config = Config.initialize({
        serverless_mode: {enabled: true},
        logging: {enabled: true}
      })
      expect(config.logging.enabled).to.be.true
    })

    it('should allow logging to be enabled from env ', () => {
      const inputConfig = {
        serverless_mode: {enabled: true}
      }

      const envVariables = {
        NEW_RELIC_LOG_ENABLED: true
      }

      idempotentEnv(envVariables, inputConfig, (config) => {
        expect(config.logging.enabled).to.be.true
      })
    })
  })

  describe('via environment variables', () => {
    it('should default logging to disabled', () => {
      idempotentEnv({
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      }, (config) => {
        expect(config.logging.enabled).to.be.false
      })
    })

    it('should allow logging to be enabled from env', () => {
      idempotentEnv({
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_LOG_ENABLED: true
      }, (config) => {
        expect(config.logging.enabled).to.be.true
      })
    })

    it('should allow logging to be enabled from configuration ', () => {
      const envVariables = {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true
      }

      const inputConfig = {
        logging: {enabled: true}
      }

      idempotentEnv(envVariables, inputConfig, (config) => {
        expect(config.logging.enabled).to.be.true
      })
    })

    it('should enable native_metrics via env variable', () => {
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

      idempotentEnv(envVariables, inputConfig,
        (config) => {
          expect(config.plugins.native_metrics.enabled).to.be.true
        })
    })

    it('should default distributed to enabled when provided with account_id', () => {
      idempotentEnv({
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '12345'
      }, (config) => {
        expect(config.distributed_tracing.enabled).to.be.true
      })
    })

    it('should allow distributed tracing to be enabled from env', () => {
      idempotentEnv({
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '12345'
      }, (config) => {
        expect(config.distributed_tracing.enabled).to.be.true
      })
    })

    it('should allow distributed tracing to be enabled from configuration ', () => {
      const envVariables = {
        NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
        NEW_RELIC_ACCOUNT_ID: '12345'
      }

      const inputConfig = {
        distributed_tracing: {enabled: true}
      }

      idempotentEnv(envVariables, inputConfig, (config) => {
        expect(config.distributed_tracing.enabled).to.be.true
      })
    })
  })
})

tap.test('serverless mode via ENV variables', (t) => {
  t.autoend()

  t.test('should pick up serverless_mode', (t) => {
    idempotentEnv({
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true
    }, (tc) => {
      t.equal(tc.serverless_mode.enabled, true)
      t.end()
    })
  })

  t.test('should explicitly disable cross_application_tracer in serverless_mode', (t) => {
    idempotentEnv({
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true
    }, (tc) => {
      t.equal(tc.serverless_mode.enabled, true)
      t.equal(tc.cross_application_tracer.enabled, false)
      t.end()
    })
  })

  t.test('should enable DT in serverless_mode when account_id has been set', (t) => {
    idempotentEnv({
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_ACCOUNT_ID: '12345'
    }, (tc) => {
      t.equal(tc.serverless_mode.enabled, true)
      t.equal(tc.distributed_tracing.enabled, true)
      t.end()
    })
  })

  t.test('should not enable distributed tracing when account_id has not been set', (t) => {
    idempotentEnv({
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true
    }, (tc) => {
      t.equal(tc.serverless_mode.enabled, true)
      t.equal(tc.distributed_tracing.enabled, false)
      t.end()
    })
  })

  t.test('should default primary_application_id to Unknown when not set', (t) => {
    idempotentEnv({
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      NEW_RELIC_ACCOUNT_ID: '12345'
    }, (tc) => {
      t.equal(tc.serverless_mode.enabled, true)
      t.equal(tc.distributed_tracing.enabled, true)

      t.equal(tc.primary_application_id, 'Unknown')
      t.end()
    })
  })

  t.test(
    'should set serverless_mode from lambda-specific env var if not set by user',
    (t) => {
      idempotentEnv({
        AWS_LAMBDA_FUNCTION_NAME: 'someFunc'
      }, (tc) => {
        t.equal(tc.serverless_mode.enabled, true)
        t.end()
      })
    }
  )

  t.test('should pick app name from AWS_LAMBDA_FUNCTION_NAME', (t) => {
    idempotentEnv({
      NEW_RELIC_SERVERLESS_MODE_ENABLED: true,
      AWS_LAMBDA_FUNCTION_NAME: 'MyLambdaFunc'
    }, (tc) => {
      t.ok(tc.app_name)
      t.deepEqual(tc.applications(), ['MyLambdaFunc'])
      t.end()
    })
  })

  t.test('should default generic app name when no AWS_LAMBDA_FUNCTION_NAME', (t) => {
    idempotentEnv({NEW_RELIC_SERVERLESS_MODE_ENABLED: true}, (tc) => {
      t.ok(tc.app_name)
      t.deepEqual(tc.applications(), ['Serverless Application'])

      t.end()
    })
  })
})
