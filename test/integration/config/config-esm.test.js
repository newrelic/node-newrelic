/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const semver = require('semver')

const match = require('../../lib/custom-assertions/match')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

// allowing require of esm made this test change
// see: https://github.com/nodejs/node/pull/55085/
// depending on node version this will either verify
// it cannot require ESM configuration or can
test('should gracefully handle ESM imports', async (t) => {
  await t.test('when requiring newrelic.js in ESM app', async () => {
    const { stdout, stderr } = await exec('node index.mjs', { cwd: path.join(__dirname, 'esm-js') })
    if (semver.gte(process.version, '22.12.0')) {
      match(stdout, 'Hello esm-test')
    } else {
      match(stderr, 'ERR_REQUIRE_ESM', 'should mention ERR_REQUIRE_ESM in error message')
    }
  })

  await t.test('when requiring newrelic.mjs in ESM app', async () => {
    const { stdout, stderr } = await exec('node index.mjs', { cwd: path.join(__dirname, 'esm-mjs') })
    if (semver.gte(process.version, '22.12.0')) {
      match(stdout, 'Hello esm-test')
    } else {
      match(stderr, 'ERR_REQUIRE_ESM', 'should mention ERR_REQUIRE_ESM in error message')
    }
  })

  await t.test('when requiring newrelic.cjs in ESM app', async () => {
    const { stdout, stderr } = await exec('node index.mjs', { cwd: path.join(__dirname, 'esm-cjs') })
    assert.deepStrictEqual(stdout, 'Hello good-esm\n', 'should greet in stdout')
    assert.deepStrictEqual(stderr, '', 'all should be quiet in stderr')
  })
})
