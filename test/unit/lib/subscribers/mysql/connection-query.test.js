/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const MySQLConnectionQuerySubscriber = require('#agentlib/subscribers/mysql/connection-query.js')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = require('../../../mocks/logger')()
  const subscriber = new MySQLConnectionQuerySubscriber({ agent, logger })
  ctx.nr = {
    agent,
    subscriber
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should match single statement use expressions', (t) => {
  const { subscriber } = t.nr
  subscriber.queryString = 'use test_db;'
  const db = subscriber.extractDatabaseChangeFromUse()
  assert.equal(db, 'test_db')
})

test('should match single use expression uppercase', (t) => {
  const { subscriber } = t.nr
  subscriber.queryString = 'USE INIT'
  const db = subscriber.extractDatabaseChangeFromUse()
  assert.equal(db, 'INIT')
})

test('should not be sensitive to ; omission', (t) => {
  const { subscriber } = t.nr
  subscriber.queryString = 'use test_db'
  const db = subscriber.extractDatabaseChangeFromUse()
  assert.equal(db, 'test_db')
})

test('should not be sensitive to extra ;', (t) => {
  const { subscriber } = t.nr
  subscriber.queryString = 'use test_db;;;;;;'
  const db = subscriber.extractDatabaseChangeFromUse()
  assert.equal(db, 'test_db')
})

const whitespaceTests = [
  '            use test_db;',
  'use             test_db;',
  '            use test_db;',
  'use test_db            ;',
  'use test_db;            '
]

for (const whitespace of whitespaceTests) {
  test(`should not be sensitive to extra white space with ${whitespace}`, (t) => {
    const { subscriber } = t.nr
    subscriber.queryString = whitespace
    const db = subscriber.extractDatabaseChangeFromUse()
    assert.equal(db, 'test_db')
  })
}

const backtickTests = [
  { statement: 'use `test_db`;', db: '`test_db`' },
  { statement: 'use `☃☃☃☃☃☃`;', db: '`☃☃☃☃☃☃`' }
]

for (const { statement, db } of backtickTests) {
  test(`should match backtick expressions ${statement}`, (t) => {
    const { subscriber } = t.nr
    subscriber.queryString = statement
    const actualDb = subscriber.extractDatabaseChangeFromUse()
    assert.equal(actualDb, db)
  })
}

const malformedExpressions = [
  'use cxvozicjvzocixjv`oasidfjaosdfij`;',
  'use `oasidfjaosdfij`123;',
  'use `oasidfjaosdfij` 123;',
  'use \u0001;',
  'use oasidfjaosdfij 123;'
]

for (const malformed of malformedExpressions) {
  test(`should not match malformed use expressions ${malformed}`, (t) => {
    const { subscriber } = t.nr
    subscriber.queryString = malformed
    const db = subscriber.extractDatabaseChangeFromUse()
    assert.equal(db, null)
  })
}
