/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var path   = require ('path')
var fs     = require('fs')
var tap    = require('tap')
var rimraf = require('rimraf')

var DIRNAME = 'XXXNOCONFTEST'


tap.test('logger', function(t) {
  t.autoend()

  t.afterEach(async() => {
    if (path.basename(process.cwd()) === DIRNAME) {
      process.chdir('..')
    }

    var dirPath = path.join(process.cwd(), DIRNAME)

    await new Promise((resolve) => {
      if (fs.existsSync(dirPath)) {
        rimraf(dirPath, resolve)
      } else {
        resolve()
      }
    })
  })

  t.test('configuration from environment', function(t) {
    fs.mkdir(DIRNAME, function(error) {
      if (!t.error(error, 'should not fail to make directory')) {
        return t.end()
      }

      process.chdir(DIRNAME)

      process.env.NEW_RELIC_LOG = 'stdout'

      t.doesNotThrow(function() {
        t.ok(require('../../lib/logger'), 'requiring logger returned a logging object')
      })

      t.end()
    })
  })
})
