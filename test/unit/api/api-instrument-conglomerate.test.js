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

tap.test('Agent API - instrumentConglomerate', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    sinon.spy(shimmer, 'registerInstrumentation')

    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    agent = null

    shimmer.registerInstrumentation.restore()

    done()
  })

  t.test('should register the instrumentation with shimmer', (t) => {
    const opts = {
      moduleName: 'foobar',
      onRequire: () => {}
    }
    api.instrumentConglomerate(opts)

    t.ok(shimmer.registerInstrumentation.calledOnce)
    const args = shimmer.registerInstrumentation.getCall(0).args
    const [actualOpts] = args
    t.equal(actualOpts, opts)
    t.equal(actualOpts.type, 'conglomerate')

    t.end()
  })

  t.test('should convert separate args into an options object', (t) => {
    function onRequire() {}
    function onError() {}
    api.instrumentConglomerate('foobar', onRequire, onError)

    const opts = shimmer.registerInstrumentation.getCall(0).args[0]
    t.equal(opts.moduleName, 'foobar')
    t.equal(opts.onRequire, onRequire)
    t.equal(opts.onError, onError)

    t.end()
  })
})
