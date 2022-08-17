/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()
const EventEmitter = require('events').EventEmitter

tap.test('Bootstrapped Logger', function (harness) {
  harness.autoend()

  let fakeLoggerConfigure
  let fakeStreamPipe
  let fakeLogger
  let fakeEmitter
  let fakeEmitterSpy
  let fakeFS
  let originalConsoleError

  harness.beforeEach(function () {
    // Make sure we don't pollute our logs
    originalConsoleError = global.console.error
    global.console.error = sinon.stub()

    fakeLoggerConfigure = sinon.stub()
    fakeStreamPipe = sinon.stub()

    fakeLogger = sinon.stub().returns({
      configure: fakeLoggerConfigure,
      pipe: fakeStreamPipe
    })

    fakeEmitter = new EventEmitter()
    fakeEmitterSpy = sinon.spy(fakeEmitter, 'on')
    fakeFS = {
      createWriteStream: sinon.stub().returns(fakeEmitter)
    }
  })

  harness.afterEach(function () {
    // Restore so we don't have a knock-on effect with other test suites
    global.console.error = originalConsoleError
  })

  harness.test('should instantiate a new logger (logging enabled + filepath)', function (test) {
    test.plan(7)

    proxyquire('../../../lib/logger', {
      './util/logger': fakeLogger,
      './util/unwrapped-core': { fs: fakeFS },
      './config': {
        getOrCreateInstance: sinon.stub().returns({
          logging: {
            enabled: true,
            filepath: '/foo/bar/baz',
            level: 'debug'
          }
        })
      }
    })

    test.ok(
      fakeLogger.calledOnceWithExactly({
        name: 'newrelic_bootstrap',
        level: 'info',
        configured: false
      }),
      'should bootstrap sub-logger'
    )

    test.ok(
      fakeLoggerConfigure.calledOnceWithExactly({
        name: 'newrelic',
        level: 'debug',
        enabled: true
      }),
      'should call logger.configure with config options'
    )

    test.ok(
      fakeFS.createWriteStream.calledOnceWithExactly('/foo/bar/baz', { flags: 'a+' }),
      'should create a new write stream to specific file'
    )

    test.ok(
      fakeStreamPipe.calledOnceWithExactly(fakeEmitter),
      'should use a new write stream for output'
    )

    const expectedError = new Error('stuff blew up')
    fakeEmitter.emit('error', expectedError)

    test.ok(
      fakeEmitterSpy.calledOnceWith('error'),
      'should handle errors emitted from the write stream'
    )
    test.ok(
      global.console.error.calledWith('New Relic failed to open log file /foo/bar/baz'),
      'should log filepath when error occurs'
    )
    test.ok(global.console.error.calledWith(expectedError), 'should log error when it occurs')

    test.end()
  })

  harness.test('should instantiate a new logger (logging enabled + stderr)', function (test) {
    test.plan(1)

    proxyquire('../../../lib/logger', {
      './util/logger': fakeLogger,
      './util/unwrapped-core': { fs: fakeFS },
      './config': {
        getOrCreateInstance: sinon.stub().returns({
          logging: {
            enabled: true,
            filepath: 'stderr',
            level: 'debug'
          }
        })
      }
    })

    test.ok(
      fakeStreamPipe.calledOnceWithExactly(process.stderr),
      'should use process.stderr for output'
    )

    test.end()
  })

  harness.test('should instantiate a new logger (logging enabled + stdout)', function (test) {
    test.plan(1)

    proxyquire('../../../lib/logger', {
      './util/logger': fakeLogger,
      './util/unwrapped-core': { fs: fakeFS },
      './config': {
        getOrCreateInstance: sinon.stub().returns({
          logging: {
            enabled: true,
            filepath: 'stdout',
            level: 'debug'
          }
        })
      }
    })

    test.ok(
      fakeStreamPipe.calledOnceWithExactly(process.stdout),
      'should use process.stdout for output'
    )

    test.end()
  })

  harness.test('should instantiate a new logger (logging disabled)', function (test) {
    test.plan(2)

    proxyquire('../../../lib/logger', {
      './util/logger': fakeLogger,
      './util/unwrapped-core': { fs: fakeFS },
      './config': {
        getOrCreateInstance: sinon.stub().returns({
          logging: {
            enabled: false,
            filepath: 'stdout',
            level: 'debug'
          }
        })
      }
    })

    test.ok(
      fakeLoggerConfigure.calledOnceWithExactly({
        name: 'newrelic',
        level: 'debug',
        enabled: false
      }),
      'should call logger.configure with config options'
    )

    test.notOk(fakeStreamPipe.called, 'should not call pipe when logging is disabled')

    test.end()
  })

  harness.test('should instantiate a new logger (no config)', function (test) {
    test.plan(1)

    proxyquire('../../../lib/logger', {
      './util/logger': fakeLogger,
      './util/unwrapped-core': { fs: fakeFS },
      './config': {
        getOrCreateInstance: sinon.stub().returns()
      }
    })

    test.notOk(fakeLoggerConfigure.called, 'should not call logger.configure')

    test.end()
  })
})
