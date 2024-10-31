/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../../lib/agent_helper')

/**
 * Note: These test had more meaning when we had legacy promise tracking.
 * We now rely on AsyncLocalStorage context manager to do to promise async propagation.  But unlike legacy
 * promise instrumentation this will only propagate the same base promise segment.
 *
 * The tests still exist to prove some more complex promise chains will not lose context
 */
test('Promise trace', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should handle straight chains', async (t) => {
    const { agent } = t.nr
    return helper.runInTransaction(agent, function (tx) {
      return start('a').then(step('b')).then(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  await t.test('should handle jumping to a catch', async (t) => {
    const { agent } = t.nr
    return helper.runInTransaction(agent, function (tx) {
      return start('a', true)
        .then(step('b'))
        .catch(step('c'))
        .then(step('d'))
        .then(checkTrace(t, tx))
    })
  })

  await t.test('should handle jumping over a catch', async (t) => {
    const { agent } = t.nr
    return helper.runInTransaction(agent, function (tx) {
      return start('a').then(step('b')).catch(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  await t.test('should handle independent branching legs', (t) => {
    const { agent } = t.nr
    return helper.runInTransaction(agent, function (tx) {
      const a = start('a')
      a.then(step('e')).then(step('f'))

      return a.then(step('b')).then(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  await t.test('should handle jumping to branched catches', (t) => {
    const { agent } = t.nr
    return helper.runInTransaction(agent, function (tx) {
      const a = start('a', true)
      a.then(step('e')).catch(step('f'))

      return a.then(step('b')).catch(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  await t.test('should handle branching in the middle', (t) => {
    const { agent } = t.nr
    return helper.runInTransaction(agent, function (tx) {
      const b = start('a').then(step('b'))
      b.then(step('e'))

      return b.then(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  await t.test('should handle jumping across a branch', (t) => {
    const { agent } = t.nr
    return helper.runInTransaction(agent, function (tx) {
      const b = start('a', true).then(step('b'))
      b.catch(step('e'))

      return b.catch(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  await t.test('should handle jumping over a branched catch', (t) => {
    const { agent } = t.nr
    return helper.runInTransaction(agent, function (tx) {
      const b = start('a').catch(step('b'))
      b.then(step('e'))

      return b.then(step('c')).then(step('d')).then(checkTrace(t, tx))
    })
  })

  await t.test('should handle branches joined by `all`', (t) => {
    const { agent } = t.nr
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

  await t.test('should handle continuing from returned promises', (t) => {
    const { agent } = t.nr
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
  const tracer = helper.getTracer()
  const segment = tracer.getSegment()
  segment.name = newName
}

function checkTrace(t, tx) {
  const tracer = helper.getTracer()
  const expectedSegment = tracer.getSegment()
  const segment = tx.trace.root
  assert.equal(segment.name, 'a')
  assert.equal(tx.trace.getChildren(segment.id).length, 0)
  // verify current segment is same as trace root
  assert.deepEqual(segment.name, expectedSegment.name, 'current segment is same as one in tracer')
  return Promise.resolve()
}
