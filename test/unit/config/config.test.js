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
    realpathSyncStub = sinon.stub(fsUnwrapped, 'realpathSync').callsFake(() => {
      return 'BadPath'
    })
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

    const result = Object.keys(pub).some((key) => {
      return key.includes('attributeFilter')
    })

    assert.ok(!result)
  })

  await t.test('should not return serialized mergeServerConfig props from publicSettings', () => {
    const pub = configuration.publicSettings()
    const result = Object.keys(pub).some((key) => {
      return key.includes('mergeServerConfig')
    })

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
