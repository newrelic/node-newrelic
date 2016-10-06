'use strict'

var path = require('path')
var chai = require('chai')
var expect = chai.expect
var util = require('../../lib/db/util')
  

/*jshint maxparams:8 */
describe('DB Utilities:', function () {
  describe('use statement parser', function () {
    var useParser = util.extractDatabaseChangeFromUse

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
