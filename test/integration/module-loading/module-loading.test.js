/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
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

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent()
  ctx.nr = { agent }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})
test('Should properly track module paths to enable shim.require()', function () {
  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
    onRequire: () => {}
  })

  const mycustomPackage = require(CUSTOM_MODULE_PATH)

  const shim = mycustomPackage[symbols.shim]
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, CUSTOM_MODULE_PATH)
  assert.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  assert.ok(shimLoadedCustom, 'shim.require() should load module')
  assert.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')
})

test('should instrument multiple versions of the same package', function () {
  const instrumentation = {
    moduleName: CUSTOM_MODULE,
    onRequire: () => {}
  }

  shimmer.registerInstrumentation(instrumentation)

  const pkg1 = require(CUSTOM_MODULE_PATH)
  const pkg2 = require(CUSTOM_MODULE_PATH_SUB)
  assert.ok(pkg1[symbols.shim], 'should wrap first package')
  assert.ok(pkg2[symbols.shim], 'should wrap sub package of same name, different version')

  const trackedItems = shimmer.registeredInstrumentations.getAllByName(CUSTOM_MODULE)
  assert.equal(trackedItems.length, 2)
  assert.equal(
    trackedItems[0].instrumentation.resolvedName.includes(CUSTOM_MODULE_PATH.slice(1)),
    true
  )
  assert.equal(
    trackedItems[1].instrumentation.resolvedName.includes(CUSTOM_MODULE_PATH_SUB.slice(1)),
    true
  )
})

test('should only log supportability metric for tracking type instrumentation', function (t) {
  const { agent } = t.nr
  const PKG = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/knex`
  const PKG_VERSION = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/knex/Version/1`

  // eslint-disable-next-line node/no-extraneous-require
  require('knex')
  const knexOnRequiredMetric = agent.metrics._metrics.unscoped[PKG]
  assert.equal(knexOnRequiredMetric.callCount, 1, `should record ${PKG}`)
  const knexVersionMetric = agent.metrics._metrics.unscoped[PKG_VERSION]
  assert.equal(knexVersionMetric.callCount, 1, `should record ${PKG_VERSION}`)
  // eslint-disable-next-line node/no-extraneous-require
  const modPath = path.dirname(require.resolve('knex'))
  assert.ok(shimmer.isInstrumented('knex', modPath), 'should mark tracking modules as instrumented')
})

test('shim.require() should play well with multiple test runs', (t) => {
  const { agent } = t.nr
  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE
  })

  require(CUSTOM_MODULE_PATH)

  helper.unloadAgent(agent)

  t.nr.agent = helper.instrumentMockedAgent()

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
    onRequire: () => {}
  })

  require(CUSTOM_MODULE_PATH)
  const mycustomPackage = require(CUSTOM_MODULE_PATH)

  const shim = mycustomPackage[symbols.shim]
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, CUSTOM_MODULE_PATH)
  assert.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  assert.ok(shimLoadedCustom, 'shim.require() should load module')
  assert.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')
})

test('Should create usage metric onRequire', (t, end) => {
  const { agent } = t.nr
  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
    onRequire: onRequireHandler
  })

  require(CUSTOM_MODULE_PATH)

  function onRequireHandler() {
    const onRequireMetric = agent.metrics._metrics.unscoped[EXPECTED_REQUIRE_METRIC_NAME]

    assert.ok(onRequireMetric)
    assert.equal(onRequireMetric.callCount, 1)
    end()
  }
})

test('Should create usage version metric onRequire', (t, end) => {
  const { agent } = t.nr
  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
    onRequire: onRequireHandler
  })

  require(CUSTOM_MODULE_PATH)

  function onRequireHandler() {
    const expectedVersionMetricName = `${EXPECTED_REQUIRE_METRIC_NAME}/Version/3`

    const onRequireMetric = agent.metrics._metrics.unscoped[expectedVersionMetricName]

    assert.ok(onRequireMetric)
    assert.equal(onRequireMetric.callCount, 1)
    end()
  }
})

test('Should create usage metric onRequire for built-in', (t) => {
  const { agent } = t.nr
  const domainMetric = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/domain`
  // eslint-disable-next-line node/no-deprecated-api
  require('domain')

  const onRequireMetric = agent.metrics._metrics.unscoped[domainMetric]

  assert.ok(onRequireMetric)
  assert.equal(onRequireMetric.callCount, 1)
  const domainMetrics = Object.keys(agent.metrics._metrics.unscoped)
  assert.equal(domainMetrics.length, 1, 'should not log a version metric for a built-in')
})

test('should instrument a local package', (t, end) => {
  shimmer.registerInstrumentation({
    moduleName: LOCAL_MODULE,
    absolutePath: LOCAL_MODULE_PATH,
    onRequire: onRequireHandler
  })

  require('./local-package')

  function onRequireHandler(shim, localPkg, name) {
    assert.equal(
      shim.pkgVersion,
      process.version,
      'defaults to node version for pkgVersion as this is not a package'
    )
    assert.ok(shim.id)
    assert.equal(name, LOCAL_MODULE)
    const result = localPkg()
    assert.deepEqual(result, { hello: 'world' })
    end()
  }
})
