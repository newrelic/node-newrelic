/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')

const helper = require('../../lib/agent_helper')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({})
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('can instrument the same module from multiple installs', async (t) => {
  const plan = tspl(t, { plan: 3 })

  const { agent } = t.nr
  agent.start(() => {
    const api = helper.getAgentApi()

    let instrumentedCount = 0
    api.instrument('test-logger', (shim, mod) => {
      shim.wrap(mod.prototype, 'info', (shim, fn) => function wrappedInfo() {
        instrumentedCount += 1
        return fn.apply(this, arguments)
      })
    })

    const { Writable } = require('stream')
    const Person = require('./testdata/index')

    const lines = []
    const dest = new Writable({
      write(chunk, _, cb) {
        lines.push(chunk.toString())
        cb()
      }
    })
    const person = new Person(dest)
    plan.equal(person.isHuman, true)
    plan.deepStrictEqual(lines, ['human constructed\n', 'person constructed\n'])

    // We loaded the same module from two different installed paths.
    // Thus, we should have two instrumentations.
    plan.equal(instrumentedCount, 2)
  })

  await plan.completed
})
