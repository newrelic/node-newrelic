'use strict'

var path = require('path')
  , chai = require('chai')
  , fs = require('fs')
  , expect = chai.expect
  , logger = require('../../lib/logger')
  

describe("Logger", function () {
  describe("when setting values", function () {
    it("shouldn't throw when passed-in log level is 0", function () {
      expect(function () { logger.level(0); }).not.throws()
    })

    it("shouldn't throw when passed-in log level is ONE MILLION", function () {
      expect(function () { logger.level(1000000); }).not.throws()
    })

    it("shouldn't throw when passed-in log level is 'verbose'", function () {
      expect(function () { logger.level('verbose'); })
    })
  })
})

describe('Log file', function(){

  beforeEach(function(){
    logger.filepath = 'test.log'
  })

  it('should not be created if logger is disabled', function(){
    logger.enabled = false
    logger.error('test')
    expect(fs.existsSync(logger.filepath)).equal(false)
  })

})
