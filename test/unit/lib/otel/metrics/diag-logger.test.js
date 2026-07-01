/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const DiagLogger = require('#agentlib/otel/metrics/diag-logger.js')

test.beforeEach((ctx) => {
  ctx.nr = {}

  const calls = []
  const logger = {
    debug(...args) {
      calls.push(['debug', ...args])
    },
    error(...args) {
      calls.push(['error', ...args])
    },
    info(...args) {
      calls.push(['info', ...args])
    },
    trace(...args) {
      calls.push(['trace', ...args])
    },
    warn(...args) {
      calls.push(['warn', ...args])
    }
  }

  ctx.nr.calls = calls
  ctx.nr.logger = logger
})

test('debug forwards to logger.debug', (t) => {
  const { logger, calls } = t.nr
  const diagLogger = new DiagLogger({ logger })

  diagLogger.debug('a message', 1, 2)
  t.assert.deepEqual(calls, [['debug', 'a message', 1, 2]])
})

test('error forwards to logger.error', (t) => {
  const { logger, calls } = t.nr
  const diagLogger = new DiagLogger({ logger })

  diagLogger.error('a message', 1, 2)
  t.assert.deepEqual(calls, [['error', 'a message', 1, 2]])
})

test('info forwards to logger.info', (t) => {
  const { logger, calls } = t.nr
  const diagLogger = new DiagLogger({ logger })

  diagLogger.info('a message', 1, 2)
  t.assert.deepEqual(calls, [['info', 'a message', 1, 2]])
})

test('verbose forwards to logger.trace', (t) => {
  const { logger, calls } = t.nr
  const diagLogger = new DiagLogger({ logger })

  diagLogger.verbose('a message', 1, 2)
  t.assert.deepEqual(calls, [['trace', 'a message', 1, 2]])
})

test('warn forwards to logger.warn', (t) => {
  const { logger, calls } = t.nr
  const diagLogger = new DiagLogger({ logger })

  diagLogger.warn('a message', 1, 2)
  t.assert.deepEqual(calls, [['warn', 'a message', 1, 2]])
})
