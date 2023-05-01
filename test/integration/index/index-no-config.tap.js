/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test

test('loading the application via index.js with no config', function (t) {
  t.plan(3)

  process.env.NEW_RELIC_HOME = '/this/is/not/a/real/path'
  process.env.HOME = '/this/is/also/not/a/real/path'
  process.cwd = function () {
    return __dirname
  }
  let api
  t.doesNotThrow(function () {
    api = require('../../../')
  }, 'should not die when the config file is not found')

  t.ok(api, 'should have an API')
  t.notOk(api.agent, 'should not have an associated agent')
})
