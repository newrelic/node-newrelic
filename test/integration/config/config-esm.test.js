/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const semver = require('semver')

const match = require('../../lib/custom-assertions/match')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

test('should gracefully handle ESM imports', async (t) => {
  // allowing require of esm made this test invalid
  // see: https://github.com/nodejs/node/pull/55085/
  // Until we can figure out if this is still valid we are skipping it
  await t.test(
    'when newrelic.js is misnamed',
    { skip: semver.gte(process.version, '22.12.0') },
    async () => {
      const { stderr } = await exec('node index.mjs', { cwd: `${__dirname}/esm-bad` })
      match(stderr, 'ERR_REQUIRE_ESM', 'should mention ERR_REQUIRE_ESM in error message')
    }
  )

  await t.test('when newrelic.cjs is properly named', async () => {
    const { stdout, stderr } = await exec('node index.mjs', { cwd: `${__dirname}/esm-good` })
    assert.deepStrictEqual(stdout, 'Hello good-esm\n', 'should greet in stdout')
    assert.deepStrictEqual(stderr, '', 'all should be quiet in stderr')
  })
})
