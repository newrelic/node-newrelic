/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')

const CONFIG_PATH = require.resolve('#agentlib/config/index.js')
const FIXTURE_DIR = __dirname

// Fields that rely on their schema default rather than being set when the
// configuration is constructed.
const SCHEMA_DEFAULTED_FIELDS = ['account_id', 'primary_application_id', 'trusted_account_key']

/**
 * Builds the configuration the same way the agent does at startup: by
 * calling `getOrCreateInstance` on a freshly loaded config module, so the
 * instance cached by a previous test is not reused.
 *
 * @returns {object} The configuration instance and the `Config` class that
 * built it.
 */
function createAgentConfig() {
  delete require.cache[CONFIG_PATH]
  const Config = require(CONFIG_PATH)
  return { Config, config: Config.getOrCreateInstance() }
}

test('schema defaulted fields', async (t) => {
  t.afterEach(() => {
    delete process.env.NEW_RELIC_HOME
    delete process.env.NEW_RELIC_NO_CONFIG_FILE
    delete process.env.NEW_RELIC_APP_NAME
    delete process.env.NEW_RELIC_LICENSE_KEY
    delete require.cache[CONFIG_PATH]
  })

  await t.test('should default to null when configured with a newrelic.js file', () => {
    process.env.NEW_RELIC_HOME = FIXTURE_DIR

    const { Config, config } = createAgentConfig()

    assert.ok(config instanceof Config, 'configuration should not be the startup error stub')
    assert.equal(config.config_file_path, path.join(FIXTURE_DIR, 'newrelic.js'))
    for (const field of SCHEMA_DEFAULTED_FIELDS) {
      assert.strictEqual(config[field], null, `unexpected value for ${field}`)
    }
  })

  await t.test('should default to null when configured with environment variables', () => {
    process.env.NEW_RELIC_NO_CONFIG_FILE = 'true'
    process.env.NEW_RELIC_APP_NAME = 'My Application'
    process.env.NEW_RELIC_LICENSE_KEY = 'a'.repeat(40)

    const { Config, config } = createAgentConfig()

    assert.ok(config instanceof Config, 'configuration should not be the startup error stub')
    for (const field of SCHEMA_DEFAULTED_FIELDS) {
      assert.strictEqual(config[field], null, `unexpected value for ${field}`)
    }
  })
})
