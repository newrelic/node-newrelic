/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const sinon = require('sinon')
const shimmer = require('../../../lib/shimmer')

test('Agent API - instrument', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)

    sinon.spy(shimmer, 'registerInstrumentation')
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    shimmer.registerInstrumentation.restore()
  })

  await t.test('exports a function for adding custom instrumentation', (t, end) => {
    const { api } = t.nr
    assert.ok(api.instrument)
    assert.equal(typeof api.instrument, 'function')

    end()
  })

  await t.test('should register the instrumentation with shimmer', (t, end) => {
    const { api } = t.nr
    const opts = {
      moduleName: 'foobar',
      onRequire: function () {}
    }
    api.instrument(opts)

    assert.ok(shimmer.registerInstrumentation.calledOnce)
    const args = shimmer.registerInstrumentation.getCall(0).args
    assert.equal(args[0], opts)

    end()
  })

  await t.test('should convert separate args into an options object', (t, end) => {
    const { api } = t.nr
    function onRequire() {}
    function onError() {}
    api.instrument('foobar', onRequire, onError)

    const opts = shimmer.registerInstrumentation.getCall(0).args[0]
    assert.equal(opts.moduleName, 'foobar')
    assert.equal(opts.onRequire, onRequire)
    assert.equal(opts.onError, onError)

    end()
  })
})
