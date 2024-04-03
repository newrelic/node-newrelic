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

const LOCAL_MODULE = 'local-package'
const LOCAL_MODULE_PATH = require.resolve('./local-package')
const CUSTOM_MODULE = 'customTestPackage'
const CUSTOM_MODULE_PATH = `./node_modules/${CUSTOM_MODULE}`
const CUSTOM_MODULE_PATH_SUB = `./node_modules/subPkg/node_modules/${CUSTOM_MODULE}`
const EXPECTED_REQUIRE_METRIC_NAME = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/${CUSTOM_MODULE}`

tap.test('Should properly track module paths to enable shim.require()', function (t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
    onRequire: () => {}
  })

  const mycustomPackage = require(CUSTOM_MODULE_PATH)

  const shim = mycustomPackage[symbols.shim]
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, CUSTOM_MODULE_PATH)
  t.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  t.ok(shimLoadedCustom, 'shim.require() should load module')
  t.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')
})

tap.test('should instrument multiple versions of the same package', function (t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  const instrumentation = {
    moduleName: CUSTOM_MODULE,
    onRequire: () => {}
  }

  shimmer.registerInstrumentation(instrumentation)

  const pkg1 = require(CUSTOM_MODULE_PATH)
  const pkg2 = require(CUSTOM_MODULE_PATH_SUB)
  t.ok(pkg1[symbols.shim], 'should wrap first package')
  t.ok(pkg2[symbols.shim], 'should wrap sub package of same name, different version')

  const trackedItems = shimmer.registeredInstrumentations.getAllByName(CUSTOM_MODULE)
  t.equal(trackedItems.length, 2)
  t.equal(trackedItems[0].instrumentation.resolvedName.includes(CUSTOM_MODULE_PATH.slice(1)), true)
  t.equal(
    trackedItems[1].instrumentation.resolvedName.includes(CUSTOM_MODULE_PATH_SUB.slice(1)),
    true
  )
})

tap.test('should only log supportability metric for tracking type instrumentation', function (t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  const PKG = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/knex`
  const PKG_VERSION = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/knex/Version/1`

  // eslint-disable-next-line node/no-extraneous-require
  require('knex')
  const knexOnRequiredMetric = agent.metrics._metrics.unscoped[PKG]
  t.equal(knexOnRequiredMetric.callCount, 1, `should record ${PKG}`)
  const knexVersionMetric = agent.metrics._metrics.unscoped[PKG_VERSION]
  t.equal(knexVersionMetric.callCount, 1, `should record ${PKG_VERSION}`)
  // eslint-disable-next-line node/no-extraneous-require
  const modPath = path.dirname(require.resolve('knex'))
  t.ok(shimmer.isInstrumented('knex', modPath), 'should mark tracking modules as instrumented')
  t.end()
})

tap.test('shim.require() should play well with multiple test runs', (t) => {
  simulateTestLoadAndUnload()

  let agent = helper.instrumentMockedAgent()

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
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

tap.test('Should create usage metric onRequire', (t) => {
  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
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
    moduleName: CUSTOM_MODULE,
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

tap.test('Should create usage metric onRequire for built-in', (t) => {
  const domainMetric = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/domain`
  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  // eslint-disable-next-line node/no-deprecated-api
  require('domain')

  const onRequireMetric = agent.metrics._metrics.unscoped[domainMetric]

  t.ok(onRequireMetric)
  t.equal(onRequireMetric.callCount, 1)
  const domainMetrics = Object.keys(agent.metrics._metrics.unscoped)
  t.equal(domainMetrics.length, 1, 'should not log a version metric for a built-in')

  t.end()
})

tap.test('should instrument a local package', (t) => {
  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: LOCAL_MODULE,
    absolutePath: LOCAL_MODULE_PATH,
    onRequire: onRequireHandler
  })

  require('./local-package')

  function onRequireHandler(shim, localPkg, name) {
    t.equal(
      shim.pkgVersion,
      process.version,
      'defaults to node version for pkgVersion as this is not a package'
    )
    t.ok(shim.id)
    t.equal(name, LOCAL_MODULE)
    const result = localPkg()
    t.same(result, { hello: 'world' })
    t.end()
  }
})

function simulateTestLoadAndUnload() {
  const agent = helper.instrumentMockedAgent()

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE
  })

  require(CUSTOM_MODULE_PATH)

  helper.unloadAgent(agent)
}
