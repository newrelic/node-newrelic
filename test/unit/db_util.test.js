/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const util = require('../../lib/db/utils')

tap.test('DB Utilities:', function (t) {
  const useParser = util.extractDatabaseChangeFromUse

  t.test('should match single statement use expressions', function (t) {
    t.equal(useParser('use test_db;'), 'test_db')
    t.equal(useParser('USE INIT'), 'INIT')
    t.end()
  })

  t.test('should not be sensitive to ; omission', function (t) {
    t.equal(useParser('use test_db'), 'test_db')
    t.end()
  })

  t.test('should not be sensitive to extra ;', function (t) {
    t.equal(useParser('use test_db;;;;;;'), 'test_db')
    t.end()
  })

  t.test('should not be sensitive to extra white space', function (t) {
    t.equal(useParser('            use test_db;'), 'test_db')
    t.equal(useParser('use             test_db;'), 'test_db')
    t.equal(useParser('            use test_db;'), 'test_db')
    t.equal(useParser('use test_db            ;'), 'test_db')
    t.equal(useParser('use test_db;            '), 'test_db')
    t.end()
  })

  t.test('should match backtick expressions', function (t) {
    t.equal(useParser('use `test_db`;'), '`test_db`')
    t.equal(useParser('use `☃☃☃☃☃☃`;'), '`☃☃☃☃☃☃`')
    t.end()
  })

  t.test('should not match malformed use expressions', function (t) {
    t.equal(useParser('use cxvozicjvzocixjv`oasidfjaosdfij`;'), null)
    t.equal(useParser('use `oasidfjaosdfij`123;'), null)
    t.equal(useParser('use `oasidfjaosdfij` 123;'), null)
    t.equal(useParser('use \u0001;'), null)
    t.equal(useParser('use oasidfjaosdfij 123;'), null)
    t.end()
  })
  t.end()
})
