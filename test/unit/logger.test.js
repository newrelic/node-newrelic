'use strict'

const chai = require('chai')
const cp = require('child_process')
const expect = chai.expect
const Logger = require('../../lib/util/logger')
const path = require('path')
const semver = require('semver')


describe('Logger', function() {
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

  describe('when setting values', function() {
    it('should not throw when passed-in log level is 0', function() {
      expect(function() {
        logger.level(0)
      }).to.not.throw()
    })

    it('should not throw when passed-in log level is ONE MILLION', function() {
      expect(function() {
        logger.level(1000000)
      }).to.not.throw()
    })

    it('should not throw when passed-in log level is "verbose"', function() {
      expect(function() {
        logger.level('verbose')
      }).to.not.throw()
    })
  })

  describe('log file', function() {
    it('should not cause crash if unwritable', function(done) {
      runTestFile('unwritable-log/unwritable.js', done)
    })

    it('should not be created if logger is disabled', function(done) {
      runTestFile('disabled-log/disabled.js', done)
    })
  })

  describe('when logging', function() {
    it('should not throw for huge messages', function(done) {
      // In Node 7 there is a bug around the relation of the heap size to the rss. If
      // this test runs then the sampler will fail when checking `Memory/NonHeap/Used`
      // because the `max` value will be negative.
      // TODO: Remove this skip check when Node 7 is deprecated.
      if (semver.satisfies(process.version, '7')) {
        return this.skip()
      }

      process.once('warning', (warning) => {
        expect(warning).to.have.property('name', 'NewRelicWarning')
        expect(warning).to.have.property('message')
        done()
      })

      let huge = 'a'
      while (huge.length < (Logger.MAX_LOG_BUFFER) / 2) {
        huge += huge
      }

      expect(() => {
        logger.fatal('some message to start the buffer off')
        logger.fatal(huge)
        logger.fatal(huge)
      }).to.not.throw()
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
