/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')

tap.beforeEach((t) => {
  t.context.agent = helper.instrumentMockedAgent({})
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
})

tap.test('can instrument the same module from multiple installs', (t) => {
  t.plan(3)

  const { agent } = t.context
  agent.start(() => {
    const api = helper.getAgentApi()

    let instrumentedCount = 0
    api.instrument('test-logger', (shim, mod) => {
      shim.wrap(mod.prototype, 'info', (shim, fn) => {
        return function wrappedInfo() {
          instrumentedCount += 1
          return fn.apply(this, arguments)
        }
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
    t.equal(person.isHuman, true)
    t.same(lines, ['human constructed\n', 'person constructed\n'])

    // We loaded the same module from two different installed paths.
    // Thus, we should have two instrumentations.
    t.equal(instrumentedCount, 2)

    t.end()
  })
})
