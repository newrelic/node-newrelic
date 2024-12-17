/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

test('loading the application via index.js with agent disabled', () => {
  process.env.NEW_RELIC_HOME = __dirname + '/..'
  process.env.NEW_RELIC_ENABLED = 'false'
  const api = require('../../../index.js')

  assert.ok(api, 'should have an API')
  assert.equal(api.agent, undefined, 'should not have an associated agent')
})
