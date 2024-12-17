/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { getTestSecret } = require('../../helpers/secrets')
const StubApi = require('../../../stub_api')

const license = getTestSecret('TEST_LICENSE')
const VERSIONS = ['garbage', '4.0.0']
test('load agent with bad versions should load stub agent', async (t) => {
  process.env.NEW_RELIC_HOME = __dirname + '/..'
  process.env.NEW_RELIC_HOST = 'staging-collector.newrelic.com'
  process.env.NEW_RELIC_LICENSE_KEY = license

  t.afterEach(() => {
    // must delete both of these to force a reload
    // of the index.js file
    delete require.cache.__NR_cache
    delete require.cache[require.resolve('../../../index.js')]
  })

  for (const version of VERSIONS) {
    await t.test(`agent version: ${version}`, (t, end) => {
      assert.doesNotThrow(function () {
        const _version = process.version
        Object.defineProperty(process, 'version', { value: version, writable: true })
        assert.equal(process.version, version, 'should have set bad version')

        const api = require('../../../index.js')
        assert.ok(api instanceof StubApi)

        process.version = _version
      }, "malformed process.version doesn't blow up the process")
      end()
    })
  }
})
