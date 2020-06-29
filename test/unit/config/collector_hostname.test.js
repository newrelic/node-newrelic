/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var expect = require('chai').expect
var Config = require('../../../lib/config')

var keyTests = require('../../lib/cross_agent_tests/collector_hostname.json')

function runWithEnv(conf, envObj, callback) {
  var saved = {}

  Object.keys(envObj).forEach(function envKey(name) {
    // process.env is not a normal object
    if (Object.hasOwnProperty.call(process.env, name)) {
      saved = process.env[name]
    }

    var value = envObj[name]
    process.env[name] = value
  })
  try {
    var tc = Config.initialize(conf)
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

var keyMapping = {
  'config_file_key': 'license_key',
  'config_override_host': 'host',
  'env_key': 'NEW_RELIC_LICENSE_KEY',
  'env_override_host': 'NEW_RELIC_HOST'
}

describe('collector host name', function() {
  keyTests.forEach(function runTest(testCase) {
    it(testCase.name, function() {
      var confSettings = {}
      var envSettings = {}
      Object.keys(testCase).forEach(function assignConfValues(key) {
        if (/^env_/.test(key)) {
          envSettings[keyMapping[key]] = testCase[key]
        } else if (/^config_/.test(key)) {
          confSettings[keyMapping[key]] = testCase[key]
        }
      })
      runWithEnv(confSettings, envSettings, checkValues)
    })
    function checkValues(conf) {
      expect(conf.host).to.equal(testCase.hostname)
    }
  })
})
