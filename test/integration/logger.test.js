/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const fs = require('node:fs')

const rimraf = require('rimraf')
const DIRNAME = 'XXXNOCONFTEST'

test('logger', async (t) => {
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

  await t.test('configuration from environment', (t, end) => {
    fs.mkdir(DIRNAME, function (error) {
      assert.ifError(error, 'should not fail to make directory')

      process.chdir(DIRNAME)

      process.env.NEW_RELIC_LOG = 'stdout'

      assert.doesNotThrow(function () {
        assert.ok(require('../../lib/logger'), 'requiring logger returned a logging object')
      })

      end()
    })
  })
})
