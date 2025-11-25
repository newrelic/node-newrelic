/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')

const Config = require('../../../lib/config')

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
    const Cornfig = require('../../../lib/config')
    let configuration

    assert.doesNotThrow(function envTest() {
      configuration = Cornfig.initialize()
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

  await t.test('should not applicationLabels if no labels defined', () => {
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

      await t.test(`should set ${samplerName}.${type} to default when ratio for trace id ratio based is not set - used wrong key`, () => {
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

        const configuration = Config.initialize(config)
        if (samplerName === 'sampler') {
          assert.equal(configuration.distributed_tracing.sampler[type], 'default')
        } else {
          assert.equal(configuration.distributed_tracing.sampler[name][type], 'default')
        }
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
    }
  }

  await t.test('should set root and remote parent sampled but leave remote parent not sampled as default', () => {
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
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_not_sampled, 'default')
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

  await t.test('should set to default when trace_id_ratio_based.ratio misconfigured', () => {
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

    const configuration = Config.initialize(config)
    assert.equal(configuration.distributed_tracing.sampler.root, 'default')
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_sampled, 'default')
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_not_sampled, 'default')
  })

  await t.test('should not assign adaptive.sampling_target if not within [1, 120] range', () => {
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

    const configuration = Config.initialize(config)
    assert.equal(configuration.distributed_tracing.sampler.root, 'default')
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_sampled, 'default')
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_not_sampled, 'default')
  })

  await t.test('should set all samplers to a string', () => {
    const config = {
      distributed_tracing: {
        sampler: {
          root: 'always_on',
          remote_parent_sampled: 'default',
          remote_parent_not_sampled: 'adaptive',
          partial_granularity: {
            root: 'adaptive',
            remote_parent_sampled: 'always_on',
            remote_parent_not_sampled: 'default'
          }
        }
      }
    }

    const configuration = Config.initialize(config)
    assert.equal(configuration.distributed_tracing.sampler.root, 'always_on')
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_sampled, 'default')
    assert.equal(configuration.distributed_tracing.sampler.remote_parent_not_sampled, 'adaptive')
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.root, 'adaptive')
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.remote_parent_sampled, 'always_on')
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.remote_parent_not_sampled, 'default')
  })

  await t.test('should set full/granularity options', () => {
    const config = {
      distributed_tracing: {
        sampler: {
          full_granularity: {
            enabled: false
          },
          partial_granularity: {
            enabled: true,
            type: 'reduced'
          }
        }
      }
    }

    const configuration = Config.initialize(config)
    assert.equal(configuration.distributed_tracing.sampler.full_granularity.enabled, false)
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.enabled, true)
    assert.equal(configuration.distributed_tracing.sampler.partial_granularity.type, 'reduced')
  })
})
