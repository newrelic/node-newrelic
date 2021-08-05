/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const sinon = require('sinon')
const shimmer = require('../../../lib/shimmer')

tap.test('Agent API - instrument', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    sinon.spy(shimmer, 'registerInstrumentation')
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null

    shimmer.registerInstrumentation.restore()
  })

  t.test('exports a function for adding custom instrumentation', (t) => {
    t.ok(api.instrument)
    t.type(api.instrument, 'function')

    t.end()
  })

  t.test('should register the instrumentation with shimmer', (t) => {
    const opts = {
      moduleName: 'foobar',
      onRequire: function () {}
    }
    api.instrument(opts)

    t.ok(shimmer.registerInstrumentation.calledOnce)
    const args = shimmer.registerInstrumentation.getCall(0).args
    t.equal(args[0], opts)

    t.end()
  })

  t.test('should convert separate args into an options object', (t) => {
    function onRequire() {}
    function onError() {}
    api.instrument('foobar', onRequire, onError)

    const opts = shimmer.registerInstrumentation.getCall(0).args[0]
    t.equal(opts.moduleName, 'foobar')
    t.equal(opts.onRequire, onRequire)
    t.equal(opts.onError, onError)

    t.end()
  })
})
