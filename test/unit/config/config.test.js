/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')

const Config = require('../../../lib/config')
const getTrackingMetricName = require('../../../lib/llm-events/get-tracking-metric-name')

test('should handle a directly passed minimal configuration', () => {
  let config
  assert.doesNotThrow(function testInitialize() {
    config = Config.initialize({})
  })
  assert.equal(config.agent_enabled, true)
})

test('when loading invalid configuration file', async (t) => {
  let realpathSyncStub
  const fsUnwrapped = require('../../../lib/util/unwrapped-core').fs

  t.beforeEach(() => {
    realpathSyncStub = sinon.stub(fsUnwrapped, 'realpathSync').callsFake(() => 'BadPath')
  })

  t.afterEach(() => {
    realpathSyncStub.restore()
  })

  await t.test('should continue agent startup with config.newrelic_home property removed', () => {
    const LocalConfig = require('../../../lib/config')
    let configuration

    assert.doesNotThrow(function envTest() {
      configuration = LocalConfig.initialize()
    })

    assert.ok(!configuration.newrelic_home)
  })
})

test('when loading options via constructor', async (t) => {
  await t.test('should properly pick up on expected_messages', () => {
    const options = {
      expected_messages: {
        Error: ['oh no']
      }
    }

    const config = new Config({
      error_collector: options
    })

    assert.deepStrictEqual(config.error_collector.expected_messages, options.expected_messages)
  })

  await t.test('should properly pick up on ignore_messages', () => {
    const options = {
      ignore_messages: {
        Error: ['oh no']
      }
    }

    const config = new Config({
      error_collector: options
    })

    assert.deepStrictEqual(config.error_collector.ignore_messages, options.ignore_messages)
  })

  await t.test('should trim should trim spaces from license key', () => {
    const config = new Config({ license_key: ' license ' })
    assert.equal(config.license_key, 'license')
  })

  await t.test('should have log aliases', () => {
    const config = new Config({ logging: { level: 'verbose' } })
    assert.equal(config.logging.level, 'trace')
  })
})

test('#publicSettings', async (t) => {
  let configuration

  t.beforeEach(() => {
    configuration = Config.initialize({})

    // ensure environment is clean
    delete configuration.newrelic_home
  })

  t.afterEach(() => {
    configuration = null
  })

  await t.test('should be able to create a flat JSONifiable version', () => {
    const pub = configuration.publicSettings()

    // The object returned from Config.publicSettings
    // should not have any values of type object
    for (const key in pub) {
      if (pub[key] !== null) {
        assert.notStrictEqual(typeof pub[key], 'object')
      }
    }
  })

  await t.test('should not return serialized attributeFilter object from publicSettings', () => {
    const pub = configuration.publicSettings()

    const result = Object.keys(pub).some((key) => key.includes('attributeFilter'))

    assert.ok(!result)
  })

  await t.test('should not return serialized mergeServerConfig props from publicSettings', () => {
    const pub = configuration.publicSettings()
    const result = Object.keys(pub).some((key) => key.includes('mergeServerConfig'))

    assert.ok(!result)
  })

  await t.test('should obfuscate certificates in publicSettings', () => {
    configuration = Config.initialize({
      certificates: ['some-pub-cert-1', 'some-pub-cert-2']
    })

    const publicSettings = configuration.publicSettings()

    assert.equal(publicSettings['certificates.0'], '****')
    assert.equal(publicSettings['certificates.1'], '****')
  })

  await t.test('should omit `ai_monitoring.enabled` when it is unset', () => {
    const pub = configuration.publicSettings()
    assert.equal(Object.hasOwn(pub, 'ai_monitoring.enabled'), false)
    // The collector treats any `ai_monitoring.*` key as the signal that the
    // agent supports AI monitoring, so the others must still be sent.
    assert.equal(pub['ai_monitoring.basic_telemetry.enabled'], true)
    assert.equal(Object.hasOwn(pub, 'ai_monitoring.record_content.enabled'), true)
    assert.equal(pub['ai_monitoring.streaming.enabled'], true)
  })

  await t.test('should turn the app name into an array', () => {
    configuration = Config.initialize({ app_name: 'test app name' })
    assert.deepStrictEqual(configuration.applications(), ['test app name'])
  })
})

test('parsedLabels', () => {
  const longKey = 'a'.repeat(257)
  const longValue = 'b'.repeat(257)
  const configuration = Config.initialize({ labels: `a: b; ${longKey}: ${longValue}` })
  assert.deepEqual(configuration.parsedLabels, [
    { label_type: 'a', label_value: 'b' },
    { label_type: 'a'.repeat(255), label_value: 'b'.repeat(255) }
  ])
})

test('parsedLabels object', () => {
  const configuration = Config.initialize({ labels: { foo: 'bar', bar: 'baz' } })
  assert.deepEqual(configuration.parsedLabels, [
    { label_type: 'foo', label_value: 'bar' },
    { label_type: 'bar', label_value: 'baz' },
  ])
})

test('parsedLabels empty values in object', () => {
  const configuration = Config.initialize({ labels: { foo: undefined, bar: undefined } })
  assert.deepEqual(configuration.parsedLabels, [])
})

test('loggingLabels', async (t) => {
  await t.test('should exclude labels regardless of case', () => {
    const config = {
      labels: {
        label1: 'value1',
        LABEL2: 'value2',
        'LABEL2-ALSO': 'value3'
      },
      application_logging: {
        forwarding: {
          labels: {
            enabled: true,
            exclude: ['LaBeL2']
          }
        }
      }
    }

    const configuration = Config.initialize(config)
    const expectedLabels = {
      'tags.label1': 'value1',
      'tags.LABEL2-ALSO': 'value3'
    }

    assert.deepEqual(configuration.loggingLabels, expectedLabels)
  })

  await t.test(
    'should not add applicationLabels when `application_logging.forwarding.labels.enabled` is false',
    () => {
      const config = {
        labels: {
          label1: 'value1',
          LABEL2: 'value2',
          'LABEL2-ALSO': 'value3'
        },
        application_logging: {
          forwarding: {
            labels: {
              enabled: false
            }
          }
        }
      }

      const configuration = Config.initialize(config)
      assert.deepEqual(configuration.loggingLabels, undefined)
    }
  )

  await t.test('should not add applicationLabels if no labels defined', () => {
    const config = {
      labels: {},
      application_logging: {
        forwarding: {
          labels: {
            enabled: true
          }
        }
      }
    }

    const configuration = Config.initialize(config)
    assert.deepEqual(configuration.loggingLabels, {})
  })
})

test('distributed tracing samplers', async (t) => {
  await t.test('should set root sampler to \'always_on\'', () => {
    const config = {
      distributed_tracing: {
        sampler: {
          root: 'always_on'
        }
      }
    }

    const configuration = Config.initialize(config)
    assert.equal(configuration.distributed_tracing.sampler.root, 'always_on')
  })

  await t.test('should set remote parent sampled sampler to \'adaptive\'', () => {
    const config = {
      distributed_tracing: {
        sampler: {
          remote_parent_sampled: 'adaptive'
        }
      }
    }

    const configuration = Config.initialize(config)
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_sampled, 'adaptive')
  })

  const samplers = ['sampler', 'sampler.partial_granularity']
  const samplerTypes = ['root', 'remote_parent_sampled', 'remote_parent_not_sampled']
  for (const samplerName of samplers) {
    const name = samplerName.split('.')[1]
    for (const type of samplerTypes) {
      await t.test(`should set ${samplerName}.${type} to trace_id_ratio_based`, () => {
        const config = {
          distributed_tracing: {
            sampler: {}
          }
        }
        const typeConfig = {
          [type]: {
            trace_id_ratio_based: {
              ratio: 0.5
            }
          }
        }

        if (samplerName === 'sampler') {
          config.distributed_tracing.sampler = typeConfig
        } else {
          config.distributed_tracing.sampler[name] = { ...typeConfig }
        }

        const configuration = Config.initialize(config)
        if (samplerName === 'sampler') {
          assert.equal(configuration.distributed_tracing.sampler[type].trace_id_ratio_based.ratio, 0.5)
        } else {
          assert.equal(configuration.distributed_tracing.sampler[name][type].trace_id_ratio_based.ratio, 0.5)
        }
      })

      await t.test(`should reject ${samplerName}.${type} trace_id_ratio_based without a ratio`, () => {
        const config = {
          distributed_tracing: {
            sampler: {}
          }
        }
        const typeConfig = {
          [type]: {
            trace_id_ratio_based: {
              wrongKey: 0.5
            }
          }
        }

        if (samplerName === 'sampler') {
          config.distributed_tracing.sampler = typeConfig
        } else {
          config.distributed_tracing.sampler[name] = { ...typeConfig }
        }

        assert.throws(
          () => Config.initialize(config),
          /trace_id_ratio_based must have required property 'ratio'/
        )
      })

      await t.test(`should set ${samplerName}.${type} to adaptive when adaptive.sampling_target is specified`, () => {
        const config = {
          distributed_tracing: {
            sampler: {}
          }
        }
        const typeConfig = {
          [type]: {
            adaptive: {
              sampling_target: 21
            }
          }
        }

        if (samplerName === 'sampler') {
          config.distributed_tracing.sampler = typeConfig
        } else {
          config.distributed_tracing.sampler[name] = { ...typeConfig }
        }

        const configuration = Config.initialize(config)
        if (samplerName === 'sampler') {
          assert.equal(configuration.distributed_tracing.sampler[type].adaptive.sampling_target, 21)
        } else {
          assert.equal(configuration.distributed_tracing.sampler[name][type].adaptive.sampling_target, 21)
        }
      })

      await t.test(`should reject ${samplerName}.${type} adaptive.sampling_target that is not an integer in [1, 120]`, () => {
        const config = {
          distributed_tracing: {
            sampler: {}
          }
        }
        const typeConfig = {
          [type]: {
            adaptive: {
              sampling_target: 'foo'
            }
          }
        }

        if (samplerName === 'sampler') {
          config.distributed_tracing.sampler = typeConfig
        } else {
          config.distributed_tracing.sampler[name] = { ...typeConfig }
        }

        assert.throws(
          () => Config.initialize(config),
          /adaptive\/sampling_target must be integer/
        )
      })
    }
  }

  await t.test('should set root and remote parent sampled but leave remote parent not sampled as adaptive', () => {
    const config = {
      distributed_tracing: {
        sampler: {
          root: {
            trace_id_ratio_based: {
              ratio: 0.5
            }
          },
          remote_parent_sampled: 'always_on'
        }
      }
    }

    const configuration = Config.initialize(config)
    assert.equal(configuration.distributed_tracing.sampler.root.trace_id_ratio_based.ratio, 0.5)
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_sampled, 'always_on')
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_not_sampled, 'adaptive')
  })

  await t.test('should set all samplers to trace id ratio based', () => {
    const config = {
      distributed_tracing: {
        sampler: {
          root: {
            trace_id_ratio_based: {
              ratio: 0.5
            }
          },
          remote_parent_sampled: {
            trace_id_ratio_based: {
              ratio: 0.6
            }
          },
          remote_parent_not_sampled: {
            trace_id_ratio_based: {
              ratio: 0.85
            }
          },
          partial_granularity: {
            root: {
              trace_id_ratio_based: {
                ratio: 0.4
              }
            },
            remote_parent_sampled: {
              trace_id_ratio_based: {
                ratio: 0.5
              }
            },
            remote_parent_not_sampled: {
              trace_id_ratio_based: {
                ratio: 0.6
              }
            }
          }
        }
      }
    }

    const configuration = Config.initialize(config)
    assert.equal(configuration.distributed_tracing.sampler.root.trace_id_ratio_based.ratio, 0.5)
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_sampled.trace_id_ratio_based.ratio, 0.6)
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_not_sampled.trace_id_ratio_based.ratio, 0.85)
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.root.trace_id_ratio_based.ratio, 0.4)
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.remote_parent_sampled.trace_id_ratio_based.ratio, 0.5)
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.remote_parent_not_sampled.trace_id_ratio_based.ratio, 0.6)
  })

  await t.test('should reject a misconfigured trace_id_ratio_based.ratio', () => {
    const config = {
      distributed_tracing: {
        sampler: {
          root: {
            trace_id_ratio_based: {
              ratio: 'invalid'
            }
          },
          remote_parent_sampled: {
            trace_id_ratio_based:
              'ratio'
          },
          remote_parent_not_sampled: {
            trace_id_ratio_based: {
              ratio: null
            }
          },
        }
      }
    }

    assert.throws(
      () => Config.initialize(config),
      /trace_id_ratio_based\/ratio must be number/
    )
  })

  await t.test('should reject adaptive.sampling_target not within [1, 120] range', () => {
    const config = {
      distributed_tracing: {
        sampler: {
          root: {
            adaptive: {
              sampling_target: 121
            }
          },
          remote_parent_sampled: {
            adaptive: {
              sampling_target: 0
            }
          },
          remote_parent_not_sampled: {
            adaptive: {
              sampling_target: null
            }
          },
        }
      }
    }

    assert.throws(
      () => Config.initialize(config),
      /adaptive\/sampling_target must be <= 120/
    )
  })

  await t.test('should set all samplers to a string', () => {
    const config = {
      distributed_tracing: {
        sampler: {
          root: 'always_on',
          remote_parent_sampled: 'adaptive',
          remote_parent_not_sampled: 'adaptive',
          partial_granularity: {
            root: 'adaptive',
            remote_parent_sampled: 'always_on',
            remote_parent_not_sampled: 'adaptive'
          }
        }
      }
    }

    const configuration = Config.initialize(config)
    assert.equal(configuration.distributed_tracing.sampler.root, 'always_on')
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_sampled, 'adaptive')
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_not_sampled, 'adaptive')
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.root, 'adaptive')
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.remote_parent_sampled, 'always_on')
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.remote_parent_not_sampled, 'adaptive')
  })

  await t.test('should set cpu profiling options', () => {
    const config = {
      profiling: {
        enabled: true,
        delay: 100,
        duration: 20000,
        sample_interval: 200,
        include: ['cpu'],
        source_mapping: { enabled: true }
      }
    }

    const configuration = Config.initialize(config)
    assert.equal(configuration.profiling.enabled, true)
    assert.equal(configuration.profiling.delay, 100)
    assert.equal(configuration.profiling.duration, 20000)
    assert.equal(configuration.profiling.sample_interval, 200)
    assert.deepEqual(configuration.profiling.include, ['cpu'])
    assert.equal(configuration.profiling.source_mapping.enabled, true)
  })

  await t.test('should set apollo server options', () => {
    const config = {
      apollo_server: {
        scalars: true,
        introspection_queries: true,
        service_definition_queries: true,
        health_check_queries: true,
        field_metrics: true,
        collapse_field_metrics: true
      }
    }

    const configuration = Config.initialize(config)
    const apollo = configuration.apollo_server
    assert.equal(apollo.scalars, true)
    assert.equal(apollo.introspection_queries, true)
    assert.equal(apollo.service_definition_queries, true)
    assert.equal(apollo.health_check_queries, true)
    assert.equal(apollo.field_metrics, true)
    assert.equal(apollo.collapse_field_metrics, true)
  })

  await t.test('should reject an invalid collapse_field_metrics value', () => {
    const config = {
      apollo_server: {
        collapse_field_metrics: 'yes'
      }
    }

    assert.throws(
      () => Config.initialize(config),
      /collapse_field_metrics must be boolean/
    )
  })
})

test('redacted_license_key', async (t) => {
  await t.test('should show first 10 characters and redact the rest', () => {
    const key = 'usa123abcdefghijklmnopqrstuvwxyz1234'
    const config = new Config({ license_key: key })
    assert.equal(config.redacted_license_key.substring(0, 10), key.substring(0, 10), 'first 10 chars should be visible')
    assert.equal(config.redacted_license_key.substring(10), '*'.repeat(key.length - 10), 'remaining chars should be redacted')
  })

  await t.test('should maintain original license key length after redaction', () => {
    const key = 'usa123abcdefghijklmnopqrstuvwxyz1234'
    const config = new Config({ license_key: key })
    assert.equal(config.redacted_license_key.length, key.length, 'redacted key should have same length as original')
    assert.equal(config.redacted_license_key, 'usa123abcd**************************', 'first 10 chars visible, rest replaced with *')
  })

  await t.test('should fully redact license keys of 10 or fewer characters', () => {
    const key = 'usa123'
    const config = new Config({ license_key: key })
    assert.equal(config.redacted_license_key.length, key.length, 'redacted key should have same length as original')
    assert.equal(config.redacted_license_key, '******', 'short keys should be fully redacted')
  })

  await t.test('should return empty string when license_key is empty', () => {
    const config = new Config({ license_key: '' })
    assert.equal(config.redacted_license_key, '', 'should return empty string for empty license')
  })
})

test('otlp_resource_attributes', () => {
  const config = Config.initialize()
  assert.deepEqual(config.otlp_resource_attributes, {})
})

test('isVmMetricsEnabled', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.emitWarning = sinon.stub(process, 'emitWarning')
  })

  t.afterEach((ctx) => {
    ctx.nr.emitWarning.restore()
  })

  await t.test('returns true by default', () => {
    const config = Config.initialize({})
    assert.equal(config.isVmMetricsEnabled(), true)
  })

  await t.test('returns false when disabled via config', () => {
    const config = Config.initialize({
      virtual_machine: {
        collect_metrics: {
          enabled: false
        }
      }
    })
    assert.equal(config.isVmMetricsEnabled(), false)
  })
})

test('Core Tracing is disabled', async (t) => {
  await t.test('should not allow disabling full granularity', () => {
    const config = Config.initialize({
      distributed_tracing: { sampler: { full_granularity: { enabled: false } } }
    })
    assert.equal(config.distributed_tracing.sampler.full_granularity.enabled, true)
  })

  await t.test('should not allow enabling partial granularity', () => {
    const config = Config.initialize({
      distributed_tracing: { sampler: { partial_granularity: { enabled: true } } }
    })
    assert.equal(config.distributed_tracing.sampler.partial_granularity.enabled, false)
  })
})

test('ai_monitoring.enabled deprecation', async (t) => {
  const MESSAGE = '`ai_monitoring.enabled` is deprecated in favor of ' +
    '`ai_monitoring.basic_telemetry.enabled` and will be removed in ' +
    'a future major version.'
  const ENV_VAR = 'NEW_RELIC_AI_MONITORING_ENABLED'
  const UNSET = 'unset'
  const ANY = 'any'

  /**
   * Stubs `process.emitWarning`, and provides a logger that captures the
   * deprecation message, for every subtest of the given suite.
   *
   * @param {object} suite The suite's test context.
   */
  function captureWarnings(suite) {
    suite.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.emitWarning = sinon.stub(process, 'emitWarning')
      ctx.nr.warnings = []
      ctx.nr.logger = {
        warn(msg) {
          if (msg === MESSAGE) {
            ctx.nr.warnings.push(msg)
          }
        },
        child() {
          return ctx.nr.logger
        },
        trace() {},
        debug() {},
        info() {},
        error() {}
      }
    })

    suite.afterEach((ctx) => {
      ctx.nr.emitWarning.restore()
      delete process.env[ENV_VAR]
    })
  }

  /**
   * Asserts the deprecation was emitted exactly once as a process
   * `DeprecationWarning`.
   *
   * @param {object} ctx The test context.
   */
  function assertEmitted(ctx) {
    assert.equal(ctx.nr.emitWarning.callCount, 1)
    assert.deepEqual(ctx.nr.emitWarning.firstCall.args, [MESSAGE, 'DeprecationWarning'])
  }

  /**
   * Asserts the deprecation was reported exactly once, both to the agent log
   * and as a process `DeprecationWarning`.
   *
   * @param {object} ctx The test context.
   */
  function assertWarned(ctx) {
    assert.deepEqual(ctx.nr.warnings, [MESSAGE])
    assertEmitted(ctx)
  }

  /**
   * Asserts the deprecation was not reported anywhere.
   *
   * @param {object} ctx The test context.
   */
  function assertNotWarned(ctx) {
    assert.deepEqual(ctx.nr.warnings, [])
    assert.equal(ctx.nr.emitWarning.callCount, 0)
  }

  /**
   * Builds an agent configuration through the real config loader so that
   * `unset` values receive their actual schema defaults.
   *
   * @param {object} params The configuration values to apply.
   * @param {boolean} params.enabled The value of `ai_monitoring.enabled`.
   * @param {boolean} params.basic The value of `ai_monitoring.basic_telemetry.enabled`.
   * @param {boolean|string} params.content The value of `ai_monitoring.record_content.enabled`, or `unset`.
   * @returns {Config} The agent configuration.
   */
  function buildAiConfig({ enabled, basic, content }) {
    const aiMonitoring = { enabled, basic_telemetry: { enabled: basic } }
    if (content !== UNSET) {
      aiMonitoring.record_content = { enabled: content }
    }
    return Config.initialize({ ai_monitoring: aiMonitoring })
  }

  /**
   * Expands `any` values into one row per possible value of that setting.
   *
   * @param {object} row A table row.
   * @returns {object[]} The rows to verify.
   */
  function expand(row) {
    const basics = row.basic === ANY ? [true, false] : [row.basic]
    const contents = row.content === ANY ? [UNSET, true, false] : [row.content]
    return basics.flatMap((basic) => contents.map((content) => {
      return { ...row, basic, content }
    }))
  }

  await t.test('warning', async (t) => {
    captureWarnings(t)

    for (const enabled of [true, false]) {
      await t.test(`should warn when set to ${enabled} in the config`, (t) => {
        new Config({ ai_monitoring: { enabled } }, { logger: t.nr.logger }) // eslint-disable-line no-new
        assertWarned(t)
      })

      await t.test(`should warn when set to ${enabled} via environment variable`, (t) => {
        process.env[ENV_VAR] = `${enabled}`
        new Config({}, { logger: t.nr.logger }) // eslint-disable-line no-new
        assertWarned(t)
      })
    }

    await t.test('should warn when set in a config passed to `Config.initialize`', (t) => {
      Config.initialize({ ai_monitoring: { enabled: true } }, { logger: t.nr.logger })
      assertWarned(t)
    })

    await t.test('should warn once when set in both the config and the environment', (t) => {
      process.env[ENV_VAR] = 'false'
      new Config({ ai_monitoring: { enabled: true } }, { logger: t.nr.logger }) // eslint-disable-line no-new
      assertWarned(t)
    })

    await t.test('should warn when set alongside `ai_monitoring.basic_telemetry.enabled`', (t) => {
      // eslint-disable-next-line no-new
      new Config(
        { ai_monitoring: { enabled: true, basic_telemetry: { enabled: true } } },
        { logger: t.nr.logger }
      )
      assertWarned(t)
    })

    await t.test('should warn when set alongside high security mode', (t) => {
      // High security mode forces the value to `false` after the check, so the
      // customer's setting must still be reported.
      // eslint-disable-next-line no-new
      new Config({ high_security: true, ai_monitoring: { enabled: true } }, { logger: t.nr.logger })
      assertWarned(t)
    })

    await t.test('should not warn when unset', (t) => {
      new Config({}, { logger: t.nr.logger }) // eslint-disable-line no-new
      assertNotWarned(t)
    })

    await t.test('should not warn when no config is provided', (t) => {
      new Config(undefined, { logger: t.nr.logger }) // eslint-disable-line no-new
      assertNotWarned(t)
    })

    await t.test('should not warn when explicitly set to `null`', (t) => {
      new Config({ ai_monitoring: { enabled: null } }, { logger: t.nr.logger }) // eslint-disable-line no-new
      assertNotWarned(t)
    })

    await t.test('should not warn when only `ai_monitoring.basic_telemetry.enabled` is set', (t) => {
      // eslint-disable-next-line no-new
      new Config({ ai_monitoring: { basic_telemetry: { enabled: false } } }, { logger: t.nr.logger })
      assertNotWarned(t)
    })

    await t.test('should not warn when only high security mode sets it', (t) => {
      new Config({ high_security: true }, { logger: t.nr.logger }) // eslint-disable-line no-new
      assertNotWarned(t)
    })

    await t.test('should not warn when set via server side config', (t) => {
      const config = new Config({}, { logger: t.nr.logger })
      config.onConnect({ agent_config: { 'ai_monitoring.enabled': true } })
      assertNotWarned(t)
    })
  })

  await t.test('behavior until removal', async (t) => {
    captureWarnings(t)

    // Rows of the "Default AIM Data Collection" precedence table that set
    // `ai_monitoring.enabled`. An explicit value wins over
    // `ai_monitoring.basic_telemetry.enabled`.
    const precedenceTable = [
      { enabled: false, basic: ANY, content: ANY, sent: false, withContent: false },
      // `record_content.enabled` is forced to `true` when it is unset.
      { enabled: true, basic: ANY, content: UNSET, sent: true, withContent: true },
      { enabled: true, basic: ANY, content: true, sent: true, withContent: true },
      { enabled: true, basic: ANY, content: false, sent: true, withContent: false }
    ]
    for (const row of precedenceTable.flatMap(expand)) {
      const { enabled, basic, content, sent, withContent } = row
      await t.test(`precedence: enabled=${enabled}, basic_telemetry=${basic}, record_content=${content}`, (t) => {
        const config = buildAiConfig(row)
        assert.equal(config.isAiMonitoringEnabled(), sent, 'isAiMonitoringEnabled')
        assert.equal(config.shouldRecordAiContent(), withContent, 'shouldRecordAiContent')
        assertEmitted(t)
      })
    }

    // No metric when AI monitoring is disabled, `/Basic` when it is enabled
    // without content, and the base metric when content is recorded.
    const BASE_METRIC = 'Supportability/Nodejs/ML/OpenAI/4.0.0'
    const BASIC_METRIC = `${BASE_METRIC}/Basic`
    const metricTable = [
      { enabled: false, basic: true, content: true, expected: null },
      { enabled: false, basic: false, content: UNSET, expected: null },
      { enabled: true, basic: true, content: UNSET, expected: BASE_METRIC },
      { enabled: true, basic: false, content: UNSET, expected: BASE_METRIC },
      { enabled: true, basic: false, content: true, expected: BASE_METRIC },
      { enabled: true, basic: true, content: false, expected: BASIC_METRIC },
      { enabled: true, basic: false, content: false, expected: BASIC_METRIC }
    ]
    for (const row of metricTable) {
      const { enabled, basic, content, expected } = row
      await t.test(`supportability metric: enabled=${enabled}, basic_telemetry=${basic}, record_content=${content}`, (t) => {
        const config = buildAiConfig(row)
        const metric = config.isAiMonitoringEnabled()
          ? getTrackingMetricName(config, BASE_METRIC)
          : null
        assert.equal(metric, expected)
        assertEmitted(t)
      })
    }

    for (const enabled of [true, false]) {
      await t.test(`should send \`ai_monitoring.enabled\` in public settings when set to ${enabled}`, (t) => {
        const config = Config.initialize({ ai_monitoring: { enabled } })
        assert.equal(config.publicSettings()['ai_monitoring.enabled'], enabled)
        assertEmitted(t)
      })
    }

    await t.test('should force content on when set to true locally before connect', (t) => {
      const config = new Config({ ai_monitoring: { enabled: true } })
      config.onConnect({ agent_config: { 'ai_monitoring.streaming.enabled': true } })
      assert.equal(config.shouldRecordAiContent(), true)
      assertEmitted(t)
    })

    await t.test('should not force content on when the connect response also sends it', (t) => {
      // Any `ai_monitoring.enabled` from the connect response cancels forcing,
      // even when it matches the local value.
      const config = new Config({ ai_monitoring: { enabled: true } })
      config.onConnect({ agent_config: { 'ai_monitoring.enabled': true } })
      assert.equal(config.isAiMonitoringEnabled(), true)
      assert.equal(config.shouldRecordAiContent(), false)
      assertEmitted(t)
    })

    await t.test('should force content on again when a later connect omits it', (t) => {
      const config = new Config({ ai_monitoring: { enabled: true } })
      config.onConnect({ agent_config: { 'ai_monitoring.enabled': true } })
      assert.equal(config.shouldRecordAiContent(), false)
      config.onConnect({ agent_config: {} })
      assert.equal(config.shouldRecordAiContent(), true)
      assertEmitted(t)
    })

    await t.test('should not let SSC basic_telemetry override a local false', (t) => {
      const config = new Config({ ai_monitoring: { enabled: false } })
      config.onConnect({ agent_config: { 'ai_monitoring.basic_telemetry.enabled': true } })
      assert.equal(config.isAiMonitoringEnabled(), false)
      assertEmitted(t)
    })
  })
})

test('virtual_machine', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.emitWarning = sinon.stub(process, 'emitWarning')
  })

  t.afterEach((ctx) => {
    ctx.nr.emitWarning.restore()
  })

  await t.test('collect_metrics defaults to true', (t) => {
    const config = Config.initialize({})
    assert.equal(config.virtual_machine.collect_metrics.enabled, true)
    assert.equal(t.nr.emitWarning.callCount, 0)
  })

  await t.test('collect_metrics can be set to false', (t) => {
    const config = Config.initialize({
      virtual_machine: {
        collect_metrics: {
          enabled: false
        }
      }
    })
    assert.equal(config.virtual_machine.collect_metrics.enabled, false)
    assert.equal(t.nr.emitWarning.callCount, 0)
  })

  await t.test('collect_metrics can be disabled via environment', (t) => {
    process.env.NEW_RELIC_VIRTUAL_MACHINE_COLLECT_METRICS_ENABLED = 'false'
    t.after(() => {
      delete process.env.NEW_RELIC_VIRTUAL_MACHINE_COLLECT_METRICS_ENABLED
    })

    const config = Config.initialize({})
    assert.equal(config.virtual_machine.collect_metrics.enabled, false)
    assert.equal(t.nr.emitWarning.callCount, 0)
  })

  await t.test('native_metrics warns when set but is honored (direct)', (t) => {
    const config = Config.initialize({
      plugins: {
        native_metrics: {
          enabled: false
        }
      }
    })
    assert.equal(config.virtual_machine.collect_metrics.enabled, true)
    assert.equal(config.plugins.native_metrics.enabled, false)
    assert.equal(config.isVmMetricsEnabled(), false)
    assert.equal(t.nr.emitWarning.callCount, 1)
  })

  await t.test('native_metrics warns when set but is honored (env)', (t) => {
    process.env.NEW_RELIC_NATIVE_METRICS_ENABLED = 'false'
    t.after(() => {
      delete process.env.NEW_RELIC_NATIVE_METRICS_ENABLED
    })

    const config = Config.initialize({})
    assert.equal(config.virtual_machine.collect_metrics.enabled, true)
    assert.equal(config.plugins.native_metrics.enabled, false)
    assert.equal(config.isVmMetricsEnabled(), false)
    assert.equal(t.nr.emitWarning.callCount, 1)
  })
})
