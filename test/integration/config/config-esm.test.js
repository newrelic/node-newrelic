/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

tap.test('should gracefully handle ESM imports', (t) => {
  t.autoend()

  t.test('when newrelic.js is misnamed', async (t) => {
    const { stderr } = await exec('node index.mjs', { cwd: `${__dirname}/esm-bad` })
    t.match(stderr, 'ERR_REQUIRE_ESM', 'should mention ERR_REQUIRE_ESM in error message')
    t.end()
  })

  t.test('when newrelic.cjs is properly named', async (t) => {
    const { stdout, stderr } = await exec('node index.mjs', { cwd: `${__dirname}/esm-good` })
    t.same(stdout, 'Hello good-esm\n', 'should greet in stdout')
    t.same(stderr, '', 'all should be quiet in stderr')
    t.end()
  })
})
