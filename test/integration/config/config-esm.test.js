/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const match = require('../../lib/custom-assertions/match')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

test('should gracefully handle ESM imports', async (t) => {
  await t.test('when newrelic.js is misnamed', async () => {
    const { stderr } = await exec('node index.mjs', { cwd: `${__dirname}/esm-bad` })
    match(stderr, 'ERR_REQUIRE_ESM', 'should mention ERR_REQUIRE_ESM in error message')
  })

  await t.test('when newrelic.cjs is properly named', async () => {
    const { stdout, stderr } = await exec('node index.mjs', { cwd: `${__dirname}/esm-good` })
    assert.deepStrictEqual(stdout, 'Hello good-esm\n', 'should greet in stdout')
    assert.deepStrictEqual(stderr, '', 'all should be quiet in stderr')
  })
})
