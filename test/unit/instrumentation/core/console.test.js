/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* eslint-disable no-console */

const tap = require('tap')
const test = tap.test

const helper = require('../../../lib/agent_helper')
const Shim = require('../../../../lib/shim/shim.js')
const { validateLogLine } = require('../../../lib/logging-helper')

tap.Test.prototype.addAssert('validateAnnotations', 2, validateLogLine)

test('Console', (t) => {
  t.autoend()

  let agent = null
  let initialize
  let shim
  let origMethods
  let logs

  t.before(() => {
    initialize = require('../../../../lib/instrumentation/core/console')
  })
  t.beforeEach((t) => {
    origMethods = {}
    logs = { debug: [], log: [], dir: [], info: [], warn: [], error: [] }
    // stub console functions to avoid littering stdout/stderr for this test
    Object.keys(logs).forEach((m) => {
      origMethods[m] = console[m]
      console[m] = function () {
        logs[m].push(Array.from(arguments))
      }
    })
    helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

    agent = helper.instrumentMockedAgent()
    shim = new Shim(agent, 'console')
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    // replace stubs
    Object.entries(origMethods).forEach(([m, func]) => {
      console[m] = func
    })
  })

  t.test('should not instrument any functions by default', (t) => {
    t.doesNotThrow(() => {
      initialize(agent, null, 'console', shim)
    })
    t.end()
  })
  t.test('should not instrument if config is not explicitly set to capture console logs', (t) => {
    const origLog = console.log

    initialize(agent, console, 'console', shim)
    t.equal(console.log, origLog, 'console.log remains as-is')

    t.end()
  })
  t.test('should instrument each method if config is set to capture console logs', (t) => {
    const logMethods = ['log', 'info', 'debug', 'warn', 'error'].reduce(
      (m, acc) => Object.assign(acc, { [m]: console[m] }),
      {}
    )
    agent.config.application_logging.capture_console.enabled = true

    initialize(agent, console, 'console', shim)
    Object.entries(logMethods).forEach(([method, origFunc]) => {
      t.not(console[method], origFunc, `console.${method} replaced`)
    })

    t.end()
  })
  t.test('adds appropriate logs to accumulator', (t) => {
    agent.config.application_logging.capture_console.enabled = true
    initialize(agent, console, 'console', shim)

    helper.runInTransaction(agent, 'test', (transaction) => {
      console.debug('msg 1')
      console.log('msg 2')
      console.info('msg 3')
      console.warn('msg 4')
      console.error('msg 5')
      console.dir({ a: { b: { c: { d: { e: 'too deep' } } } } }, { depth: 3 })
      transaction.end()
      const logEvents = agent.logs.getEvents()
      t.ok(logEvents.find((evt) => evt.level === 'debug' && evt.message === 'msg 1'))
      t.ok(logEvents.find((evt) => evt.level === 'info' && evt.message === 'msg 2'))
      t.ok(logEvents.find((evt) => evt.level === 'info' && evt.message === 'msg 3'))
      t.ok(logEvents.find((evt) => evt.level === 'warn' && evt.message === 'msg 4'))
      t.ok(logEvents.find((evt) => evt.level === 'error' && evt.message === 'msg 5'))
      t.ok(
        logEvents.find((evt) => evt.level === 'info' && evt.message.indexOf('{ d: [Object] }') > 0)
      )

      logEvents.forEach((evt) => {
        t.hasProps(
          evt,
          ['timestamp', 'entity.name', 'entity.type', 'hostname', 'trace.id', 'span.id'],
          'has all expected properties'
        )
      })

      t.end()
    })
  })

  t.test('adds linking data when local decoration enabled', (t) => {
    agent.config.application_logging.capture_console.enabled = true
    agent.config.application_logging.local_decorating.enabled = true
    agent.config.application_logging.forwarding.enabled = false
    initialize(agent, console, 'console', shim)

    helper.runInTransaction(agent, 'test', (transaction) => {
      console.debug('msg 1')
      console.log('msg 2')
      console.info('msg 3')
      console.warn('msg 4')
      console.error('msg 5')
      console.dir({ msg: 'msg 6' })
      transaction.end()
      const logEvents = agent.logs.getEvents()
      t.ok(logEvents.length === 0, 'no logs collected in agent')
      Object.entries(logs).forEach(([level, [l]]) => {
        t.match(l, /msg \d.* NR-LINKING/, `has embedded linking data (${level})`)
      })
      t.end()
    })
  })
})
