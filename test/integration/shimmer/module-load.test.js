/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const shimmer = require('../../../lib/shimmer')

tap.test('Test Module Instrumentation Loading', (t) => {
  t.autoend()
  let agent = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    agent = null
    done()
  })

  t.test("__NR_instrumented set correctly", (t) => {
    // path to our module fixture from this file
    const modulePathLocal = './module-load-fixture'

    // path to our module fixture from the shimmer --
    // needed since `reinstrument` results in a call
    // to require _from_ from the shimmer
    const modulePathFromShimmer = '../test/integration/shimmer/module-load-fixture'

    // register our instrumentation == onRequire will be
    // the code that's normally in the "instrument" function
    // that a instrumentation module exports
    shimmer.registerInstrumentation({
      moduleName: modulePathFromShimmer,
      type: null,
      onRequire: () => {}
    })

    // use reinstrument helper method to
    // manually instrument our module
    shimmer.reinstrument(agent, modulePathFromShimmer)

    const module = require(modulePathLocal)

    t.ok(module, 'loaded module')
    t.equals(module(), 'hello world', 'module behaves as expected')
    t.ok(module.__NR_instrumented, '__NR_instrumented set and true')
    t.end()
  })

  t.test("__NR_instrumented_errored set correctly", (t) => {
    // path to our module fixture from this file
    const modulePathLocal = './module-load-fixture-errored'

    // path to our module fixture from the shimmer --
    // needed since `reinstrument` results in a call
    // to require _from_ from the shimmer
    const modulePathFromShimmer = '../test/integration/shimmer/module-load-fixture-errored'

    // register our instrumentation == onRequire will be
    // the code that's normally in the "instrument" function
    // that a instrumentation module exports
    shimmer.registerInstrumentation({
      moduleName: modulePathFromShimmer,
      type: null,
      onRequire: () => {
        throw new Error('our instrumentation errors')
      }
    })

    // use reinstrument helper method to
    // manually instrument our module
    shimmer.reinstrument(agent, modulePathFromShimmer)

    const module = require(modulePathLocal)

    t.ok(module, 'loaded module')
    t.equals(module(), 'hello world', 'module behaves as expected')
    t.ok(module.__NR_instrumented_errored, '__NR_instrumented_errored set and true')
    t.end()
  })
})
