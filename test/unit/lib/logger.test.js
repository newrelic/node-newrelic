/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()
const EventEmitter = require('events').EventEmitter

test('Bootstrapped Logger', async (t) => {
  let fakeLoggerConfigure
  let fakeStreamPipe
  let fakeLogger
  let testEmitter
  let testEmitterSpy
  let fakeFS
  let originalConsoleError

  t.beforeEach(() => {
    // Make sure we don't pollute our logs
    originalConsoleError = global.console.error
    global.console.error = sinon.stub()

    fakeLoggerConfigure = sinon.stub()
    fakeStreamPipe = sinon.stub()

    fakeLogger = sinon.stub().returns({
      configure: fakeLoggerConfigure,
      pipe: fakeStreamPipe
    })

    testEmitter = new EventEmitter()
    testEmitterSpy = sinon.spy(testEmitter, 'on')
    fakeFS = {
      createWriteStream: sinon.stub().returns(testEmitter)
    }
  })

  t.afterEach(() => {
    // Restore so we don't have a knock-on effect with other test suites
    global.console.error = originalConsoleError
  })

  await t.test('should instantiate a new logger (logging enabled + filepath)', () => {
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

    assert.ok(
      fakeLogger.calledOnceWithExactly({
        name: 'newrelic_bootstrap',
        level: 'info',
        configured: false
      }),
      'should bootstrap sub-logger'
    )

    assert.ok(
      fakeLoggerConfigure.calledOnceWithExactly({
        name: 'newrelic',
        level: 'debug',
        enabled: true
      }),
      'should call logger.configure with config options'
    )

    assert.ok(
      fakeFS.createWriteStream.calledOnceWithExactly('/foo/bar/baz', { flags: 'a+', mode: 0o600 }),
      'should create a new write stream to specific file'
    )

    assert.ok(
      fakeStreamPipe.calledOnceWithExactly(testEmitter),
      'should use a new write stream for output'
    )

    const expectedError = new Error('stuff blew up')
    testEmitter.emit('error', expectedError)

    assert.ok(
      testEmitterSpy.calledOnceWith('error'),
      'should handle errors emitted from the write stream'
    )
    assert.ok(
      global.console.error.calledWith('New Relic failed to open log file /foo/bar/baz'),
      'should log filepath when error occurs'
    )
    assert.ok(global.console.error.calledWith(expectedError), 'should log error when it occurs')
  })

  await t.test('should instantiate a new logger (logging enabled + stderr)', () => {
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

    assert.ok(
      fakeStreamPipe.calledOnceWithExactly(process.stderr),
      'should use process.stderr for output'
    )
  })

  await t.test('should instantiate a new logger (logging enabled + stdout)', () => {
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

    assert.ok(
      fakeStreamPipe.calledOnceWithExactly(process.stdout),
      'should use process.stdout for output'
    )
  })

  await t.test('should instantiate a new logger (logging disabled)', () => {
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

    assert.ok(
      fakeLoggerConfigure.calledOnceWithExactly({
        name: 'newrelic',
        level: 'debug',
        enabled: false
      }),
      'should call logger.configure with config options'
    )

    assert.ok(!fakeStreamPipe.called, 'should not call pipe when logging is disabled')
  })

  await t.test('should instantiate a new logger (no config)', () => {
    proxyquire('../../../lib/logger', {
      './util/logger': fakeLogger,
      './util/unwrapped-core': { fs: fakeFS },
      './config': {
        getOrCreateInstance: sinon.stub().returns()
      }
    })

    assert.ok(!fakeLoggerConfigure.called, 'should not call logger.configure')
  })
})
