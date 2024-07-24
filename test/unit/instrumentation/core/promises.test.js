/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test

const helper = require('../../../lib/agent_helper')

/**
 * Note: These test had more meaning when we had legacy promise tracking.
 * We now rely on AsyncLocalStorage context maanger to do to promise async propagation.  But unlike legacy
 * promise instrumentation this will only propagate the same base promise segment.
 *
 * The tests still exist to prove some more complex promise chains will not lose context
 */
test('Promise trace', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should handle straight chains', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      return start('a').then(step('b')).then(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  t.test('should handle jumping to a catch', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      return start('a', true)
        .then(step('b'))
        .catch(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx))
    })
  })

  t.test('should handle jumping over a catch', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      return start('a').then(step('b')).catch(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  t.test('should handle independent branching legs', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      const a = start('a')
      a.then(step('e')).then(step('f'))

      return a.then(step('b')).then(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  t.test('should handle jumping to branched catches', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      const a = start('a', true)
      a.then(step('e')).catch(step('f'))

      return a.then(step('b')).catch(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  t.test('should handle branching in the middle', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      const b = start('a').then(step('b'))
      b.then(step('e'))

      return b.then(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  t.test('should handle jumping across a branch', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      const b = start('a', true).then(step('b'))
      b.catch(step('e'))

      return b.catch(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  t.test('should handle jumping over a branched catch', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      const b = start('a').catch(step('b'))
      b.then(step('e'))

      return b.then(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  t.test('should handle branches joined by `all`', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      return start('a')
        .then(function () {
          name('b')
          return Promise.all([start('e').then(step('f')), start('g')])
        })
        .then(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx))
    })
  })

  t.test('should handle continuing from returned promises', (t) => {
    return helper.runInTransaction(agent, function (tx) {
      return start('a')
        .then(step('b'))
        .then(function () {
          name('e')
          return start('f').then(step('g'))
        })
        .then(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx))
    })
  })
})

function start(n, rejection) {
  return new Promise(function startExecutor(resolve, reject) {
    name(n)
    rejection ? reject(new Error(n + ' rejection (start)')) : resolve()
  })
}

function step(n, rejection) {
  return function thenStep() {
    name(n)
    if (rejection) {
      throw new Error(n + ' rejection (step)')
    }
  }
}

function name(newName) {
  const segment = helper.getContextManager().getContext()
  segment.name = newName
}

function checkTrace(t, tx) {
  const segment = tx.trace.root
  t.equal(segment.name, 'a')
  t.equal(segment.children.length, 0)
  // verify current segment is same as trace root
  t.same(
    segment.name,
    helper.getContextManager().getContext().name,
    'current segment is same as one in async context manager'
  )
  return Promise.resolve()
}
