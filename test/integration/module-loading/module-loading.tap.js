/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const path = require('path')

const helper = require('../../lib/agent_helper')
const shimmer = require('../../../lib/shimmer')

const CUSTOM_MODULE_PATH = './node_modules/customTestPackage'
const EXPECTED_RESOLVED_METRIC_NAME =
  'Supportability/Features/Instrumentation/OnResolved/./node_modules/customTestPackage'
const EXPECTED_REQUIRE_METRIC_NAME =
  'Supportability/Features/Instrumentation/OnRequire/./node_modules/customTestPackage'

tap.test('Should properly track module paths to enable shim.require()', function (t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE_PATH,
    onRequire: () => {}
  })

  // As of node 11, this path is being cached, and will not hit our resolve hooks for
  // subsequent calls.  This extra require call ensures we cover the cached case.
  require(CUSTOM_MODULE_PATH)
  const mycustomPackage = require(CUSTOM_MODULE_PATH)

  const shim = mycustomPackage.__NR_shim
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, CUSTOM_MODULE_PATH)
  t.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  t.ok(shimLoadedCustom, 'shim.require() should load module')
  t.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')
})

tap.test('shim.require() should play well with multiple test runs', (t) => {
  simulateTestLoadAndUnload()

  let agent = helper.instrumentMockedAgent()

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE_PATH,
    onRequire: () => {}
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  require(CUSTOM_MODULE_PATH)
  const mycustomPackage = require(CUSTOM_MODULE_PATH)

  const shim = mycustomPackage.__NR_shim
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, CUSTOM_MODULE_PATH)
  t.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  t.ok(shimLoadedCustom, 'shim.require() should load module')
  t.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')

  t.end()
})

tap.test('Should create usage metric onResolved', (t) => {
  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE_PATH,
    onResolved: onResolvedHandler
  })

  require(CUSTOM_MODULE_PATH)

  function onResolvedHandler() {
    const onResolvedMetric = agent.metrics._metrics.unscoped[EXPECTED_RESOLVED_METRIC_NAME]

    t.ok(onResolvedMetric)
    t.equal(onResolvedMetric.callCount, 1)

    t.end()
  }
})

tap.test('Should create usage version metric onResolved', (t) => {
  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE_PATH,
    onResolved: onResolvedHandler
  })

  require(CUSTOM_MODULE_PATH)

  function onResolvedHandler() {
    const expectedVersionMetricName = `${EXPECTED_RESOLVED_METRIC_NAME}/Version/3`

    const onResolvedMetric = agent.metrics._metrics.unscoped[expectedVersionMetricName]

    t.ok(onResolvedMetric)
    t.equal(onResolvedMetric.callCount, 1)

    t.end()
  }
})

tap.test('Should create usage metric onRequire', (t) => {
  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE_PATH,
    onRequire: onRequireHandler
  })

  require(CUSTOM_MODULE_PATH)

  function onRequireHandler() {
    const onRequireMetric = agent.metrics._metrics.unscoped[EXPECTED_REQUIRE_METRIC_NAME]

    t.ok(onRequireMetric)
    t.equal(onRequireMetric.callCount, 1)

    t.end()
  }
})

tap.test('Should create usage version metric onRequire', (t) => {
  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE_PATH,
    onRequire: onRequireHandler
  })

  require(CUSTOM_MODULE_PATH)

  function onRequireHandler() {
    const expectedVersionMetricName = `${EXPECTED_REQUIRE_METRIC_NAME}/Version/3`

    const onRequireMetric = agent.metrics._metrics.unscoped[expectedVersionMetricName]

    t.ok(onRequireMetric)
    t.equal(onRequireMetric.callCount, 1)

    t.end()
  }
})

function simulateTestLoadAndUnload() {
  const agent = helper.instrumentMockedAgent()

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE_PATH
  })

  require(CUSTOM_MODULE_PATH)

  helper.unloadAgent(agent)
}
