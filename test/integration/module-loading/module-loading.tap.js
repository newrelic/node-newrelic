/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const path = require('path')

const helper = require('../../lib/agent_helper')
const shimmer = require('../../../lib/shimmer')
const symbols = require('../../../lib/symbols')
const { FEATURES } = require('../../../lib/metrics/names')

const CUSTOM_MODULE_PATH = './node_modules/customTestPackage'
const EXPECTED_RESOLVED_METRIC_NAME = `${FEATURES.INSTRUMENTATION.ON_RESOLVED}/${CUSTOM_MODULE_PATH}`
const EXPECTED_REQUIRE_METRIC_NAME = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/${CUSTOM_MODULE_PATH}`

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

  const shim = mycustomPackage[symbols.shim]
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, CUSTOM_MODULE_PATH)
  t.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  t.ok(shimLoadedCustom, 'shim.require() should load module')
  t.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')
})

tap.test('should only log supportability metric for tracking type instrumentation', function (t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  const PKG = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/@prisma/client`
  const PKG_VERSION = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/@prisma/client/Version/3`

  // eslint-disable-next-line node/no-extraneous-require
  const prisma = require('@prisma/client')
  const prismaOnRequiredMetric = agent.metrics._metrics.unscoped[PKG]
  t.equal(prismaOnRequiredMetric.callCount, 1, `should record ${PKG}`)
  const prismaVersionMetric = agent.metrics._metrics.unscoped[PKG_VERSION]
  t.equal(prismaVersionMetric.callCount, 1, `should record ${PKG_VERSION}`)
  t.notOk(
    prisma[symbols.instrumented],
    'should not try to instrument a package that is of type tracking'
  )
  t.end()
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

  const shim = mycustomPackage[symbols.shim]
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
