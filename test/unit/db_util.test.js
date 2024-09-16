/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const useParser = require('../../lib/db/utils').extractDatabaseChangeFromUse

test('should match single statement use expressions', () => {
  assert.equal(useParser('use test_db;'), 'test_db')
  assert.equal(useParser('USE INIT'), 'INIT')
})

test('should not be sensitive to ; omission', () => {
  assert.equal(useParser('use test_db'), 'test_db')
})

test('should not be sensitive to extra ;', () => {
  assert.equal(useParser('use test_db;;;;;;'), 'test_db')
})

test('should not be sensitive to extra white space', () => {
  assert.equal(useParser('            use test_db;'), 'test_db')
  assert.equal(useParser('use             test_db;'), 'test_db')
  assert.equal(useParser('            use test_db;'), 'test_db')
  assert.equal(useParser('use test_db            ;'), 'test_db')
  assert.equal(useParser('use test_db;            '), 'test_db')
})

test('should match backtick expressions', () => {
  assert.equal(useParser('use `test_db`;'), '`test_db`')
  assert.equal(useParser('use `☃☃☃☃☃☃`;'), '`☃☃☃☃☃☃`')
})

test('should not match malformed use expressions', () => {
  assert.equal(useParser('use cxvozicjvzocixjv`oasidfjaosdfij`;'), null)
  assert.equal(useParser('use `oasidfjaosdfij`123;'), null)
  assert.equal(useParser('use `oasidfjaosdfij` 123;'), null)
  assert.equal(useParser('use \u0001;'), null)
  assert.equal(useParser('use oasidfjaosdfij 123;'), null)
})
