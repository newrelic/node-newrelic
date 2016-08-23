'use strict'

var chai = require('chai')
var cp = require('child_process')
var expect = chai.expect
var Logger = require('../../lib/util/logger')
var path = require('path')

describe("Logger", function() {
  var logger = null

  beforeEach(function() {
    logger = new Logger({
      name: 'newrelic',
      level: 'trace',
      enabled: true
    })
  })

  afterEach(function() {
    logger = null
  })

  describe("when setting values", function() {
    it("shouldn't throw when passed-in log level is 0", function() {
      expect(function() {
        logger.level(0)
      }).to.not.throw()
    })

    it("shouldn't throw when passed-in log level is ONE MILLION", function() {
      expect(function() {
        logger.level(1000000)
      }).to.not.throw()
    })

    it("shouldn't throw when passed-in log level is 'verbose'", function() {
      expect(function() {
        logger.level('verbose')
      }).to.not.throw()
    })
  })

  describe("log file", function() {
    it('should not cause crash if unwritable', function(done) {
      runTestFile('unwritable-log/unwritable.js', done)
    })

    it('should not be created if logger is disabled', function(done) {
      runTestFile('disabled-log/disabled.js', done)
    })
  })
})

function runTestFile(file, cb) {
  var testHelperDir = path.resolve(__dirname, '../helpers/')
  var proc = cp.fork(path.join(testHelperDir, file), {silent: true})
  var message = null

  proc.on('message', function(msg) {
    message = msg
  })

  proc.on('exit', function() {
    if (message && message.error) {
      cb(message.error)
    } else {
      cb()
    }
  })
}
