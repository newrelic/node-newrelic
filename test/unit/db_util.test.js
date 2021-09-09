/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const chai = require('chai')
const expect = chai.expect
const util = require('../../lib/db/utils')

describe('DB Utilities:', function () {
  describe('use statement parser', function () {
    const useParser = util.extractDatabaseChangeFromUse

    it('should match single statement use expressions', function () {
      expect(useParser('use test_db;')).equal('test_db')
      expect(useParser('USE INIT')).equal('INIT')
    })

    it('should not be sensitive to ; omission', function () {
      expect(useParser('use test_db')).equal('test_db')
    })

    it('should not be sensitive to extra ;', function () {
      expect(useParser('use test_db;;;;;;')).equal('test_db')
    })

    it('should not be sensitive to extra white space', function () {
      expect(useParser('            use test_db;')).equal('test_db')
      expect(useParser('use             test_db;')).equal('test_db')
      expect(useParser('            use test_db;')).equal('test_db')
      expect(useParser('use test_db            ;')).equal('test_db')
      expect(useParser('use test_db;            ')).equal('test_db')
    })

    it('should match backtick expressions', function () {
      expect(useParser('use `test_db`;')).equal('`test_db`')
      expect(useParser('use `☃☃☃☃☃☃`;')).equal('`☃☃☃☃☃☃`')
    })

    it('should not match malformed use expressions', function () {
      expect(useParser('use cxvozicjvzocixjv`oasidfjaosdfij`;')).equal(null)
      expect(useParser('use `oasidfjaosdfij`123;')).equal(null)
      expect(useParser('use `oasidfjaosdfij` 123;')).equal(null)
      expect(useParser('use \u0001;')).equal(null)
      expect(useParser('use oasidfjaosdfij 123;')).equal(null)
    })
  })
})
