/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const shimmer = require('../../../lib/shimmer')
const symbols = require('../../../lib/symbols')

tap.test('Test Module Instrumentation Loading', (t) => {
  t.autoend()
  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('symbols.instrumented set correctly', (t) => {
    // path to our module fixture from this file
    const modulePathLocal = './module-load-fixture'

    // path to our module fixture from the shimmer --
    // needed since `reinstrument` results in a call
    // to require _from_ from the shimmer
    const modulePathFromShimmer = '../test/integration/shimmer/module-load-fixture'

    // register our instrumentation == onRequire will be
    // the code that's normally in the "instrument" function
    // that a instrumentation module exports
    const instrumentation = {
      moduleName: modulePathFromShimmer,
      type: null,
      onRequire: () => {}
    }

    shimmer.registerInstrumentation(instrumentation)

    // use reinstrument helper method to
    // manually instrument our module
    shimmer.reinstrument(agent, modulePathFromShimmer)

    const module = require(modulePathLocal)

    t.ok(module, 'loaded module')
    t.equal(module(), 'hello world', 'module behaves as expected')
    t.ok(instrumentation[symbols.instrumented].has(process.version))
    t.end()
  })

  t.test('symbols.instrumentedErrored set correctly', (t) => {
    // path to our module fixture from this file
    const modulePathLocal = './module-load-fixture-errored'

    // path to our module fixture from the shimmer --
    // needed since `reinstrument` results in a call
    // to require _from_ from the shimmer
    const modulePathFromShimmer = '../test/integration/shimmer/module-load-fixture-errored'

    // register our instrumentation == onRequire will be
    // the code that's normally in the "instrument" function
    // that a instrumentation module exports
    const instrumentation = {
      moduleName: modulePathFromShimmer,
      type: null,
      onRequire: () => {
        throw new Error('our instrumentation errors')
      }
    }
    shimmer.registerInstrumentation(instrumentation)

    // use reinstrument helper method to
    // manually instrument our module
    shimmer.reinstrument(agent, modulePathFromShimmer)

    const module = require(modulePathLocal)

    t.ok(module, 'loaded module')
    t.equal(module(), 'hello world', 'module behaves as expected')
    t.ok(instrumentation[symbols.instrumentedErrored].has(process.version))
    t.end()
  })
})
