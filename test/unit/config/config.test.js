/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')

const Config = require('../../../lib/config')

tap.test('should handle a directly passed minimal configuration', (t) => {
  let config
  t.doesNotThrow(function testInitialize() {
    config = Config.initialize({})
  })
  t.equal(config.agent_enabled, true)

  t.end()
})

tap.test('when loading invalid configuration file', (t) => {
  t.autoend()

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

  t.test('should continue agent startup with config.newrelic_home property removed', (t) => {
    const Cornfig = require('../../../lib/config')
    let configuration

    t.doesNotThrow(function envTest() {
      configuration = Cornfig.initialize()
    })

    t.notOk(configuration.newrelic_home)

    t.end()
  })
})

tap.test('when loading options via constructor', (t) => {
  t.autoend()

  t.test('should properly pick up on expected_messages', (t) => {
    const options = {
      expected_messages: {
        Error: ['oh no']
      }
    }

    const config = new Config({
      error_collector: options
    })

    t.same(config.error_collector.expected_messages, options.expected_messages)
    t.end()
  })

  t.test('should properly pick up on ignore_messages', (t) => {
    const options = {
      ignore_messages: {
        Error: ['oh no']
      }
    }

    const config = new Config({
      error_collector: options
    })

    t.same(config.error_collector.ignore_messages, options.ignore_messages)
    t.end()
  })

  t.test('should trim should trim spaces from license key', (t) => {
    const config = new Config({ license_key: ' license ' })
    t.equal(config.license_key, 'license')

    t.end()
  })

  t.test('should have log aliases', (t) => {
    const config = new Config({ logging: { level: 'verbose' } })
    t.equal(config.logging.level, 'trace')

    t.end()
  })
})

tap.test('#publicSettings', (t) => {
  t.autoend()

  let configuration

  t.beforeEach(() => {
    configuration = Config.initialize({})

    // ensure environment is clean
    delete configuration.newrelic_home
  })

  t.afterEach(() => {
    configuration = null
  })

  t.test('should be able to create a flat JSONifiable version', (t) => {
    const pub = configuration.publicSettings()

    // The object returned from Config.publicSettings
    // should not have any values of type object
    for (const key in pub) {
      if (pub[key] !== null) {
        t.not(typeof pub[key], 'object')
      }
    }

    t.end()
  })

  t.test('should not return serialized attributeFilter object from publicSettings', (t) => {
    const pub = configuration.publicSettings()

    const result = Object.keys(pub).some((key) => {
      return key.includes('attributeFilter')
    })

    t.notOk(result)

    t.end()
  })

  t.test('should not return serialized mergeServerConfig props from publicSettings', (t) => {
    const pub = configuration.publicSettings()
    const result = Object.keys(pub).some((key) => {
      return key.includes('mergeServerConfig')
    })

    t.notOk(result)

    t.end()
  })

  t.test('should obfuscate certificates in publicSettings', (t) => {
    configuration = Config.initialize({
      certificates: ['some-pub-cert-1', 'some-pub-cert-2']
    })

    const publicSettings = configuration.publicSettings()

    t.equal(publicSettings['certificates.0'], '****')
    t.equal(publicSettings['certificates.1'], '****')

    t.end()
  })
})
