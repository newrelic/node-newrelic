/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const fs = require('node:fs/promises')
const DIRNAME = 'XXXNOCONFTEST'

test.afterEach(async () => {
  // use working dir because the test changes to the directory
  const dirPath = path.resolve(process.cwd())
  await fs.rm(dirPath, { recursive: true })
  delete process.env.NEW_RELIC_LOG
})

test('logger: configuration from environment', async () => {
  await fs.mkdir(DIRNAME)
  process.chdir(DIRNAME)

  process.env.NEW_RELIC_LOG = 'stdout'

  assert.doesNotThrow(function () {
    assert.ok(require('../../lib/logger'), 'requiring logger returned a logging object')
  })
})
