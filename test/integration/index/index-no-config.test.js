/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

test('loading the application via index.js with no config', (t) => {
  process.env.NEW_RELIC_HOME = '/this/is/not/a/real/path'
  process.env.HOME = '/this/is/also/not/a/real/path'
  process.cwd = function () {
    return __dirname
  }

  const logs = []
  const logError = console.error
  t.after(() => {
    console.error = logError
  })
  console.error = (...args) => logs.push(args)

  let api
  assert.doesNotThrow(function () {
    api = require('../../../')
  }, 'should not die when the config file is not found')

  assert.ok(api, 'should have an API')
  assert.equal(api.agent, undefined, 'should not have an associated agent')
  assert.equal(logs.length, 2)
})
