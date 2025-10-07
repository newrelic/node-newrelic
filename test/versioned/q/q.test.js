/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const tspl = require('@matteo.collina/tspl')

const { removeModules } = require('../../lib/cache-buster')
const tempRemoveListeners = require('../../lib/temp-remove-listeners')
const helper = require('../../lib/agent_helper')
const { assertPackageMetrics } = require('../../lib/custom-assertions')

function assertTransaction(agent, tx, expect = assert) {
  expect.equal(agent.getTransaction(), tx)
  const children = tx.trace.getChildren(tx.trace.root.id)
  expect.equal(children.length, 0)
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.q = require('q')
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['q'])
})

test('should load tracking metrics', (t) => {
  const { agent } = t.nr
  const { version } = require('q/package.json')
  assertPackageMetrics({ agent, pkg: 'q', version })
})

test('q.invoke', (t, end) => {
  const { agent, q } = t.nr
  const firstTest = q.defer()
  const secondTest = q.defer()

  helper.runInTransaction(agent, (tx) => {
    q.ninvoke(() => {
      assertTransaction(agent, tx)
      firstTest.resolve()
    })
  })

  helper.runInTransaction(agent, (tx) => {
    q.ninvoke(() => {
      assertTransaction(agent, tx)
      secondTest.resolve()
    })
  })

  q.all([firstTest, secondTest]).then(() => end())
})

test('q.then', (t, end) => {
  const { agent, q } = t.nr
  const firstTest = q.defer()
  const secondTest = q.defer()

  helper.runInTransaction(agent, (tx) => {
    q(true).then(function () {
      assertTransaction(agent, tx)
      firstTest.resolve()
    })
  })

  helper.runInTransaction(agent, (tx) => {
    q(true).then(function () {
      assertTransaction(agent, tx)
      secondTest.resolve()
    })
  })

  q.all([firstTest, secondTest]).then(() => end())
})

test('q.then rejections', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, q } = t.nr

  tempRemoveListeners({ t, emitter: process, event: 'unhandledRejection' })

  const firstTest = q.defer()
  const secondTest = q.defer()

  helper.runInTransaction(agent, (tx) => {
    const thrownError = new Error('First unhandled error')
    process.on('unhandledRejection', (error) => {
      if (error === thrownError) {
        assertTransaction(agent, tx, plan)
        firstTest.resolve()
      }
    })
    q(true).then(() => {
      throw thrownError
    })
  })

  helper.runInTransaction(agent, (tx) => {
    const thrownError = new Error('Second unhandled error')
    process.on('unhandledRejection', (error) => {
      if (error === thrownError) {
        assertTransaction(agent, tx, plan)
        secondTest.resolve()
      }
    })
    q(true).then(() => {
      throw thrownError
    })
  })

  q.all([firstTest.promise, secondTest.promise])
  await plan.completed
})
