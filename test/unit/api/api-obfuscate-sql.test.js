/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - obfuscateSql', (t) => {
  const agent = helper.instrumentMockedAgent()
  const api = new API(agent)

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  const sql = `select * from foo where a='b' and c=100;`
  const obfuscated = api.obfuscateSql(sql, 'postgres')
  t.equal(obfuscated, 'select * from foo where a=? and c=?;')
  t.end()
})
