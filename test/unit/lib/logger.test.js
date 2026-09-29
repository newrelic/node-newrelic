/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// This test suite verifies that the bootstrapping logger works as intended.
// The bootstrapping logger is used prior to configuration being fully
// parsed and validated. It accumulates logs until configuration is ready,
// and then reconfigures itself to the production logger and flushes the
// accumulated data to the configured final destination stream.

const test = require('node:test')
const assert = require('node:assert')
const { Writable } = require('node:stream')
const { removeMatchedModules } = require('#testlib/cache-buster.js')

const { fs } = require('#agentlib/util/unwrapped-core.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    logger: require('#agentlib/logger.js')
  }

  // Make sure we don't pollute our logs.
  ctx.nr.errorLogs = []
  ctx.nr.originalConsoleError = global.console.error
  global.console.error = (...args) => {
    ctx.nr.errorLogs.push(args)
  }

  ctx.nr.destinationStream = new Writable({
    write(chunk, encoding, cb) {
      cb()
    }
  })
  ctx.nr.origCreateWriteStream = fs.createWriteStream
  ctx.nr.createStreamArgs = []
  fs.createWriteStream = (path, options) => {
    Array.prototype.push.apply(ctx.nr.createStreamArgs, [path, options])
    return ctx.nr.destinationStream
  }
})

test.afterEach((ctx) => {
  fs.createWriteStream = ctx.nr.origCreateWriteStream
  removeMatchedModules(/unwrapped-core\.js/)
  removeMatchedModules(/logger\.js/)
  global.console.error = ctx.nr.originalConsoleError
})

test('should configure the logger (logging enabled + filepath)', (t) => {
  const { logger } = t.nr

  let configureOptions
  logger.configure = (opts) => { configureOptions = opts }
  let pipe
  logger.pipe = (p) => { pipe = p }

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
  assert.deepStrictEqual(
    configureOptions,
    {
      auditLogging: false,
      enabled: true,
      level: 'debug',
      name: 'newrelic'
    },
    'invokes .configure with the correct options'
  )

  assert.deepStrictEqual(
    t.nr.createStreamArgs,
    ['/foo/bar/baz', { flags: 'a+', mode: 0o600 }],
    'should create a new write stream to specific file'
  )

  assert.equal(
    pipe,
    t.nr.destinationStream,
    'should assign a new stream for the destination'
  )

  const expectedError = new Error('stuff blew up')
  t.nr.destinationStream.emit('error', expectedError)

  assert.deepStrictEqual(
    t.nr.errorLogs[0],
    [
      'New Relic failed to open log file',
      '/foo/bar/baz'
    ],
    'should log error to console when it occurs'
  )
})

test('should configure the logger (logging enabled + stderr)', (t) => {
  const { logger } = t.nr
  let pipe
  logger.pipe = (p) => { pipe = p }

  process.emit('nr-config-load-complete', {
    logging: {
      enabled: true,
      filepath: 'stderr',
      level: 'debug'
    }
  })

  assert.equal(pipe, process.stderr, 'should use process.stderr for output')
})

test('should configure the logger (logging enabled + stdout)', (t) => {
  const { logger } = t.nr
  let pipe
  logger.pipe = (p) => { pipe = p }

  process.emit('nr-config-load-complete', {
    logging: {
      enabled: true,
      filepath: 'stdout',
      level: 'debug'
    }
  })

  assert.ok(pipe, process.stdout, 'should use process.stdout for output')
})

test('should configure the logger (logging disabled)', (t) => {
  const { logger } = t.nr
  let configureOptions
  logger.configure = (opts) => { configureOptions = opts }
  let pipe
  logger.pipe = (p) => { pipe = p }

  process.emit('nr-config-load-complete', {
    logging: {
      enabled: false,
      filepath: 'stdout',
      level: 'debug'
    }
  })

  assert.deepStrictEqual(
    configureOptions,
    {
      auditLogging: false,
      enabled: false,
      level: 'debug',
      name: 'newrelic'
    },
    'invokes .configure with the correct options'
  )

  assert.equal(pipe, undefined, 'should not call pipe when logging is disabled')
})

test('should not configure the logger when no config load completes', (t) => {
  const { logger } = t.nr
  let configureOptions
  logger.configure = (opts) => { configureOptions = opts }
  assert.equal(configureOptions, undefined, 'should not call logger.configure')
})

test('should only pipe once across multiple config loads', (t) => {
  const { logger } = t.nr
  let pipeCount = 0
  logger.pipe = () => { pipeCount += 1 }

  const config = {
    logging: {
      enabled: true,
      filepath: 'stdout',
      level: 'debug'
    }
  }

  // The logger reconfigures on each `nr-config-load-complete`, but it must only
  // pipe to a destination once; re-piping the shared logger stream on every load
  // would stack `data`/`end` listeners on it.
  process.emit('nr-config-load-complete', config)
  process.emit('nr-config-load-complete', config)
  process.emit('nr-config-load-complete', config)

  assert.equal(pipeCount, 1, 'should invoke pipe exactly once')
})
