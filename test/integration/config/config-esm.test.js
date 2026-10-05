/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const util = require('node:util')
const exec = util.promisify(require('node:child_process').exec)

// allowing require of esm made this test change
// see: https://github.com/nodejs/node/pull/55085/
// depending on node version this will either verify
// it cannot require ESM configuration or can
test('should gracefully handle ESM imports', async (t) => {
  await t.test('when requiring newrelic.cjs in ESM app', async () => {
    const { stdout, stderr } = await exec('node index.mjs', { cwd: path.join(__dirname, 'esm-cjs') })
    assert.deepStrictEqual(stdout, 'Hello good-esm\n', 'should greet in stdout')
    assert.deepStrictEqual(stderr, '', 'all should be quiet in stderr')
  })
})
