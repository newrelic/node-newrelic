/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const fs = require('fs')
const tap = require('tap')
const rimraf = require('rimraf')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const DIRNAME = 'XXXNOCONFTEST'

tap.test('logger', function (t) {
  t.autoend()

  t.afterEach(async () => {
    if (path.basename(process.cwd()) === DIRNAME) {
      process.chdir('..')
    }

    const dirPath = path.join(process.cwd(), DIRNAME)

    await new Promise((resolve) => {
      if (fs.existsSync(dirPath)) {
        rimraf(dirPath, resolve)
      } else {
        resolve()
      }
    })
    delete process.env.NEW_RELIC_LOG
  })

  t.test('configuration from environment', function (t) {
    fs.mkdir(DIRNAME, function (error) {
      if (!t.error(error, 'should not fail to make directory')) {
        return t.end()
      }

      process.chdir(DIRNAME)

      process.env.NEW_RELIC_LOG = 'stdout'

      t.doesNotThrow(function () {
        t.ok(require('../../lib/logger'), 'requiring logger returned a logging object')
      })

      t.end()
    })
  })
})

tap.test('Logger output', (t) => {
  t.autoend()

  t.test('Check for logger output at debug level', async (t) => {
    const { stdout, stderr } = await exec('node -r ../../../index.js hello.js', {
      cwd: `${__dirname}/logger-test-case`
    })
    t.equal(stdout, 'Hello cool-app\n', 'should get the normal output')
    t.match(
      stderr,
      /Application was invoked as .*node -r ..\/..\/..\/index.js .*hello.js/,
      'should contain `node -r` in the logs'
    )
    t.end()
  })
})
