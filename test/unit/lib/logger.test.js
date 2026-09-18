/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { EventEmitter } = require('node:events')
const sinon = require('sinon')

const logger = require('#agentlib/logger.js')
const unwrappedCore = require('#agentlib/util/unwrapped-core.js')

test('Bootstrapped Logger', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    // Make sure we don't pollute our logs.
    ctx.nr.originalConsoleError = global.console.error
    global.console.error = sinon.stub()

    // The logger reconfigures itself in response to the
    // `nr-config-load-complete` event. Spy on its real methods so we can assert
    // how it reacts, and stub the write stream creation so nothing touches the
    // filesystem.
    ctx.nr.configureSpy = sinon.spy(logger, 'configure')
    ctx.nr.pipeStub = sinon.stub(logger, 'pipe')

    ctx.nr.fakeStream = new EventEmitter()
    ctx.nr.createWriteStreamStub = sinon
      .stub(unwrappedCore.fs, 'createWriteStream')
      .returns(ctx.nr.fakeStream)
  })

  t.afterEach((ctx) => {
    global.console.error = ctx.nr.originalConsoleError
    sinon.restore()
  })

  await t.test('should configure the logger (logging enabled + filepath)', (t) => {
    const { configureSpy, pipeStub, fakeStream, createWriteStreamStub } = t.nr

    process.emit('nr-config-load-complete', {
      logging: {
        enabled: true,
        filepath: '/foo/bar/baz',
        level: 'debug'
      },
      audit_log: {
        enabled: false
      }
    })

    assert.ok(
      configureSpy.calledOnceWithExactly({
        name: 'newrelic',
        level: 'debug',
        enabled: true,
        auditLogging: false
      }),
      'should call logger.configure with config options'
    )

    assert.ok(
      createWriteStreamStub.calledOnceWithExactly('/foo/bar/baz', { flags: 'a+', mode: 0o600 }),
      'should create a new write stream to specific file'
    )

    assert.ok(
      pipeStub.calledOnceWithExactly(fakeStream),
      'should use a new write stream for output'
    )

    const expectedError = new Error('stuff blew up')
    fakeStream.emit('error', expectedError)

    assert.ok(
      global.console.error.calledWith('New Relic failed to open log file', '/foo/bar/baz'),
      'should log filepath when error occurs'
    )
    assert.ok(global.console.error.calledWith(expectedError), 'should log error when it occurs')
  })

  await t.test('should configure the logger (logging enabled + stderr)', (t) => {
    process.emit('nr-config-load-complete', {
      logging: {
        enabled: true,
        filepath: 'stderr',
        level: 'debug'
      }
    })

    assert.ok(
      t.nr.pipeStub.calledOnceWithExactly(process.stderr),
      'should use process.stderr for output'
    )
  })

  await t.test('should configure the logger (logging enabled + stdout)', (t) => {
    process.emit('nr-config-load-complete', {
      logging: {
        enabled: true,
        filepath: 'stdout',
        level: 'debug'
      }
    })

    assert.ok(
      t.nr.pipeStub.calledOnceWithExactly(process.stdout),
      'should use process.stdout for output'
    )
  })

  await t.test('should configure the logger (logging disabled)', (t) => {
    process.emit('nr-config-load-complete', {
      logging: {
        enabled: false,
        filepath: 'stdout',
        level: 'debug'
      }
    })

    assert.ok(
      t.nr.configureSpy.calledOnceWithExactly({
        name: 'newrelic',
        level: 'debug',
        enabled: false,
        auditLogging: false
      }),
      'should call logger.configure with config options'
    )

    assert.ok(!t.nr.pipeStub.called, 'should not call pipe when logging is disabled')
  })

  await t.test('should not configure the logger when no config load completes', (t) => {
    assert.ok(!t.nr.configureSpy.called, 'should not call logger.configure')
  })
})
