/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

test('Agent API - obfuscateSql', (t, end) => {
  const agent = helper.instrumentMockedAgent()
  const api = new API(agent)

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const sql = `select * from foo where a='b' and c=100;`
  const obfuscated = api.obfuscateSql(sql, 'postgres')
  assert.equal(obfuscated, 'select * from foo where a=? and c=?;')
  end()
})
