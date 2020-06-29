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

  t.afterEach(function(done) {
    if (path.basename(process.cwd()) === DIRNAME) {
      process.chdir('..')
    }

    var dirPath = path.join(process.cwd(), DIRNAME)
    if (fs.existsSync(dirPath)) {
      rimraf(dirPath, done)
    } else {
      done()
    }
  })

  t.test('configuration from environment', function(t) {
    fs.mkdir(DIRNAME, function(error) {
      if (!t.error(error, 'should not fail to make directory')) {
        return t.end()
      }

      process.chdir(DIRNAME)

      process.env.NEW_RELIC_LOG = 'stdout'
      process.env.NEW_RELIC_NO_CONFIG_FILE = 'true'

      t.doesNotThrow(function() {
        t.ok(require('../../lib/logger'), 'requiring logger returned a logging object')
      })

      t.end()
    })
  })
})
