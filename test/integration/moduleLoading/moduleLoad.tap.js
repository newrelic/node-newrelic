'use strict'

const tap  = require('tap')
const path = require('path')

const helper = require('../../lib/agent_helper')
const shimmer = require('../../../lib/shimmer')

const customPackagePath = './node_modules/customTestPackage'

tap.test('Should properly track module paths to enable shim.require()', function(t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.tearDown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: customPackagePath
  })

  const mycustomPackage = require(customPackagePath)

  const shim = mycustomPackage.__NR_shim
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, customPackagePath)
  t.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  t.ok(shimLoadedCustom, 'shim.require() should load module')
  t.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')
})
