/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Config = require('../../../lib/config')
const keyTests = require('../../lib/cross_agent_tests/collector_hostname.json')

const keyMapping = {
  config_file_key: 'license_key',
  config_override_host: 'host',
  env_key: 'NEW_RELIC_LICENSE_KEY',
  env_override_host: 'NEW_RELIC_HOST'
}

test('collector host name', async (t) => {
  for (const testCase of keyTests) {
    await t.test(testCase.name, async () => {
      const confSettings = {}
      const envSettings = {}
      Object.keys(testCase).forEach(function assignConfValues(key) {
        if (/^env_/.test(key)) {
          envSettings[keyMapping[key]] = testCase[key]
        } else if (/^config_/.test(key)) {
          confSettings[keyMapping[key]] = testCase[key]
        }
      })

      runWithEnv(confSettings, envSettings, (config) => {
        assert.equal(config.host, testCase.hostname)
      })
    })
  }
})

function runWithEnv(conf, envObj, callback) {
  let saved = {}

  Object.keys(envObj).forEach(function envKey(name) {
    // process.env is not a normal object
    if (Object.hasOwnProperty.call(process.env, name)) {
      saved = process.env[name]
    }

    const value = envObj[name]
    process.env[name] = value
  })
  try {
    const tc = Config.initialize(conf)
    callback(tc)
  } finally {
    Object.keys(envObj).forEach(function restoreEnv(name) {
      if (saved[name]) {
        process.env[name] = saved[name]
      } else {
        delete process.env[name]
      }
    })
  }
}
