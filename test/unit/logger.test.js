/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const chai = require('chai')
const cp = require('child_process')
const expect = chai.expect
const Logger = require('../../lib/util/logger')
const path = require('path')

describe('Logger', function () {
  let logger = null

  beforeEach(function () {
    logger = new Logger({
      name: 'newrelic',
      level: 'trace',
      enabled: true
    })
  })

  afterEach(function () {
    logger = null
  })

  describe('when setting values', function () {
    it('should not throw when passed-in log level is 0', function () {
      expect(function () {
        logger.level(0)
      }).to.not.throw()
    })

    it('should not throw when passed-in log level is ONE MILLION', function () {
      expect(function () {
        logger.level(1000000)
      }).to.not.throw()
    })

    it('should not throw when passed-in log level is "verbose"', function () {
      expect(function () {
        logger.level('verbose')
      }).to.not.throw()
    })
  })

  describe('log file', function () {
    it('should not cause crash if unwritable', function (done) {
      runTestFile('unwritable-log/unwritable.js', done)
    })

    it('should not be created if logger is disabled', function (done) {
      runTestFile('disabled-log/disabled.js', done)
    })
  })

  describe('when logging', function () {
    it('should not throw for huge messages', function (done) {
      process.once('warning', (warning) => {
        expect(warning).to.have.property('name', 'NewRelicWarning')
        expect(warning).to.have.property('message')
        done()
      })

      let huge = 'a'
      while (huge.length < Logger.MAX_LOG_BUFFER / 2) {
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
  const testHelperDir = path.resolve(__dirname, '../helpers/')
  const proc = cp.fork(path.join(testHelperDir, file), { silent: true })
  let message = null

  proc.on('message', function (msg) {
    message = msg
  })

  proc.on('exit', function () {
    if (message && message.error) {
      cb(message.error)
    } else {
      cb()
    }
  })
}
