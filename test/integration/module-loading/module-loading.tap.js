/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const path = require('path')

const helper = require('../../lib/agent_helper')
const shimmer = require('../../../lib/shimmer')

const customPackagePath = './node_modules/customTestPackage'

tap.test('Should properly track module paths to enable shim.require()', function (t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: customPackagePath
  })

  // As of node 11, this path is being cached, and will not hit our resolve hooks for
  // subsequent calls.  This extra require call ensures we cover the cached case.
  require(customPackagePath)
  const mycustomPackage = require(customPackagePath)

  const shim = mycustomPackage.__NR_shim
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, customPackagePath)
  t.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  t.ok(shimLoadedCustom, 'shim.require() should load module')
  t.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')
})

tap.test('shim.require() should play well with multiple test runs', (t) => {
  simulateTestLoadAndUnload()

  let agent = helper.instrumentMockedAgent()

  shimmer.registerInstrumentation({
    moduleName: customPackagePath
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  require(customPackagePath)
  const mycustomPackage = require(customPackagePath)

  const shim = mycustomPackage.__NR_shim
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, customPackagePath)
  t.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  t.ok(shimLoadedCustom, 'shim.require() should load module')
  t.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')

  t.end()
})

function simulateTestLoadAndUnload() {
  const agent = helper.instrumentMockedAgent()

  shimmer.registerInstrumentation({
    moduleName: customPackagePath
  })

  require(customPackagePath)

  helper.unloadAgent(agent)
}
