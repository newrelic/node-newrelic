/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import sinon from 'sinon'
import * as td from 'testdouble'
import path from 'node:path'
import esmHelpers from '../lib/esm-helpers.mjs'
const __dirname = esmHelpers.__dirname(import.meta.url)
const TEST_MOD_FILE_PATH = path.resolve(`${__dirname}../lib/test-mod.mjs`)
const ESM_SHIM_FILE_PATH = path.resolve(`${__dirname}../../lib/esm-shim.mjs`)
const MOD_URL = `file://${TEST_MOD_FILE_PATH}`

tap.test('ES Module Loader', { skip: !esmHelpers.supportedLoaderVersion() }, (t) => {
  t.autoend()

  let fakeSpecifier
  let fakeContext
  let fakeNextResolve
  let fakeNewrelic
  let fakeGetOrCreateMetric
  let fakeIncrementCallCount
  let fakeShimmer
  let fakeLogger
  let fakeLoggerChild
  let loader
  let loadStub

  t.beforeEach(async () => {
    fakeSpecifier = 'my-test-dep'
    fakeContext = {}
    fakeNextResolve = sinon.stub()
    loadStub = sinon.stub()

    fakeLoggerChild = {
      debug: sinon.stub(),
      error: sinon.stub()
    }

    fakeLogger = {
      child: sinon.stub().returns(fakeLoggerChild)
    }

    fakeIncrementCallCount = sinon.stub()
    fakeGetOrCreateMetric = sinon.stub()

    fakeNewrelic = {
      agent: {
        metrics: {
          getOrCreateMetric: fakeGetOrCreateMetric.returnsThis(),
          incrementCallCount: fakeIncrementCallCount.returnsThis()
        }
      }
    }

    fakeShimmer = {
      registerInstrumentation: sinon.stub(),
      getInstrumentationNameFromModuleName: sinon.stub(),
      registeredInstrumentations: {
        express: {
          moduleName: 'express',
          type: 'web-framework',
          onRequire: sinon.stub()
        }
      }
    }

    await td.replaceEsm('../../index.js', {}, fakeNewrelic)
    await td.replaceEsm('../../lib/shimmer.js', {}, fakeShimmer)
    await td.replaceEsm('../../lib/logger.js', {}, fakeLogger)

    loader = await import('../../esm-loader.mjs')
    sinon.spy(loader.registeredSpecifiers, 'get')
  })

  t.afterEach(() => {
    td.reset()
  })

  t.test('should not update the usage metric if misconfigured', async (t) => {
    delete fakeNewrelic.agent

    fakeGetOrCreateMetric.resetHistory()
    fakeIncrementCallCount.resetHistory()

    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    loader = await import('../../esm-loader.mjs')

    t.ok(fakeGetOrCreateMetric.notCalled, 'should not get a usage metric')
    t.ok(fakeIncrementCallCount.notCalled, 'should not increment a usage metric')
  })

  t.test('should update the loader metric when on a supported version of node', async (t) => {
    t.ok(
      fakeGetOrCreateMetric.calledOnceWith('Supportability/Features/ESM/Loader'),
      'should get the correct usage metric'
    )
    t.equal(fakeIncrementCallCount.callCount, 1, 'should increment the metric')
  })

  t.test('should exit early if agent is not running', async (t) => {
    delete fakeNewrelic.agent

    await loader.resolve(fakeSpecifier, fakeContext, fakeNextResolve)

    t.ok(fakeNextResolve.calledOnceWith(fakeSpecifier), 'should only call nextResolve once')
    t.ok(
      fakeShimmer.getInstrumentationNameFromModuleName.notCalled,
      'should not have called getInstrumentationNameFromModuleName'
    )
    t.ok(
      fakeLogger.child.calledOnceWithExactly({ component: 'esm-loader' }),
      'should instantiate the logger'
    )
  })

  t.test('should exit early if the import is coming from loader', async (t) => {
    fakeContext.parentURL = '/path/to/newrelic/esm-loader.mjs'
    await loader.resolve(fakeSpecifier, fakeContext, fakeNextResolve)

    t.ok(fakeNextResolve.calledOnceWith(fakeSpecifier), 'should only call nextResolve once')
    t.ok(
      fakeShimmer.getInstrumentationNameFromModuleName.notCalled,
      'should not have called getInstrumentationNameFromModuleName'
    )
    t.ok(
      fakeLogger.child.calledOnceWithExactly({ component: 'esm-loader' }),
      'should instantiate the logger'
    )
  })

  t.test('should noop if module we are resolving does not have instrumentation', async (t) => {
    fakeShimmer.getInstrumentationNameFromModuleName.returnsArg(0)
    fakeNextResolve.returns({ url: 'file://path/to/my-test-dep/index.js', format: 'commonjs' })

    const expected = await loader.resolve(fakeSpecifier, fakeContext, fakeNextResolve)

    t.same(
      expected,
      { url: 'file://path/to/my-test-dep/index.js', format: 'commonjs' },
      'should return an object with url and format'
    )
    t.ok(fakeLoggerChild.debug.notCalled, 'should not log any debug statements')
    t.ok(
      fakeShimmer.registerInstrumentation.notCalled,
      'should not have registered an instrumentation copy'
    )
  })

  t.test(
    'should add specifier to map and append hasNrInstrumentation to url if module we are resolving has instrumentation',
    async (t) => {
      fakeShimmer.getInstrumentationNameFromModuleName.returnsArg(0)
      fakeShimmer.registeredInstrumentations['my-test-dep'] = {
        moduleName: 'my-test-dep',
        type: 'generic',
        onRequire: sinon.stub()
      }
      fakeNextResolve.returns({ url: 'file://path/to/my-test-dep/index.js', format: 'module' })

      const expected = await loader.resolve(fakeSpecifier, fakeContext, fakeNextResolve)

      t.same(
        expected,
        { url: 'file://path/to/my-test-dep/index.js?hasNrInstrumentation=true', format: 'module' },
        'should return an object with url and format'
      )
      t.equal(fakeLoggerChild.debug.callCount, 1, 'should log two debug statements')
      t.ok(
        fakeLoggerChild.debug.calledWith('Instrumentation exists for my-test-dep module package.'),
        'should log debug about instrumentation existing'
      )
      t.ok(
        fakeShimmer.registerInstrumentation.notCalled,
        'should not have registered an instrumentation copy'
      )
    }
  )

  t.test(
    'should register a copy of CommonJS instrumentation under the full filepath',
    async (t) => {
      fakeShimmer.getInstrumentationNameFromModuleName.returnsArg(0)
      fakeShimmer.registeredInstrumentations['my-test-dep'] = {
        moduleName: 'my-test-dep',
        type: 'generic',
        onRequire: sinon.stub()
      }
      fakeNextResolve.returns({ url: 'file://path/to/my-test-dep/index.js', format: 'commonjs' })

      const expected = await loader.resolve(fakeSpecifier, fakeContext, fakeNextResolve)

      t.same(
        expected,
        { url: 'file://path/to/my-test-dep/index.js', format: 'commonjs' },
        'should return an object with url and format'
      )
      t.equal(fakeLoggerChild.debug.callCount, 2, 'should log two debug statements')
      t.ok(
        fakeLoggerChild.debug.calledWith(
          'Instrumentation exists for my-test-dep commonjs package.'
        ),
        'should log debug about instrumentation existing'
      )
      t.ok(
        fakeLoggerChild.debug.calledWith(
          'Registered CommonJS instrumentation for my-test-dep under path/to/my-test-dep/index.js'
        ),
        'should log debug about instrumentation registration'
      )

      const expectedInstrumentation = Object.assign(
        {},
        fakeShimmer.registeredInstrumentations['my-test-dep']
      )
      expectedInstrumentation.moduleName = 'path/to/my-test-dep/index.js'
      expectedInstrumentation.specifier = 'my-test-dep'

      t.ok(
        fakeShimmer.registerInstrumentation.calledOnceWithExactly(expectedInstrumentation),
        'should have registered an instrumentation copy'
      )
    }
  )

  t.test('should rewrite module context if it has instrumentation', async (t) => {
    loader.registeredSpecifiers.set(MOD_URL, 'test-mod')

    const data = await loader.load(`${MOD_URL}?hasNrInstrumentation=true`, {}, loadStub)
    const expectedSource = `
    import wrapModule from 'file://${ESM_SHIM_FILE_PATH}'
    import * as _originalModule from '${MOD_URL}'
    // lets have as little code in here as possible and push most to
    // a helper function or class
    const _wrappedModule = wrapModule(_originalModule, 'test-mod', '${TEST_MOD_FILE_PATH}')
    // Generate matching exports
    
    let _default = _wrappedModule.default
    // this allows for dynamically mapping to default
    export { _default as default }

    let _namedMethod = _wrappedModule.namedMethod
    // this allows for dynamically mapping to namedMethod
    export { _namedMethod as namedMethod }
  `
    t.equal(data.source, expectedSource, 'should rewrite source accordingly')
    t.equal(data.format, 'module', 'should be of format module')
    t.ok(data.shortCircuit, 'should apply shortcuit to load hook')
  })

  t.test('should call next load if imported url lacks `hasNrInstrumentation`', async (t) => {
    await loader.load(MOD_URL, {}, loadStub)
    t.equal(loader.registeredSpecifiers.get.callCount, 0, 'should have exited early')
    t.equal(loadStub.callCount, 1, 'should have called next loader')
  })

  t.test('should call next load if url is invalid', async (t) => {
    await loader.load('nope', {}, loadStub)
    t.equal(loader.registeredSpecifiers.get.callCount, 0, 'should have exited early')
    t.equal(loadStub.callCount, 1, 'should have called next loader')
    t.equal(fakeLoggerChild.error.callCount, 1, 'should log error')
  })
})

tap.test('Skipped ESM loader', { skip: esmHelpers.supportedLoaderVersion() }, (t) => {
  t.autoend()

  let mockedAgent = null
  let mockedShimmer = null
  let loader = null
  let resolveStub = null
  let loadStub = null
  let fakeGetOrCreateMetric
  let fakeIncrementCallCount

  t.beforeEach(async () => {
    resolveStub = sinon.stub()
    loadStub = sinon.stub()

    fakeIncrementCallCount = sinon.stub()
    fakeGetOrCreateMetric = sinon.stub()

    mockedAgent = {
      agent: {
        metrics: {
          getOrCreateMetric: fakeGetOrCreateMetric.returnsThis(),
          incrementCallCount: fakeIncrementCallCount.returnsThis()
        }
      }
    }

    mockedShimmer = {
      getInstrumentationNameFromModuleName: sinon.stub()
    }

    await td.replaceEsm('../../index.js', {}, mockedAgent)
    await td.replaceEsm('../../lib/shimmer.js', {}, mockedShimmer)
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    loader = await import('../../esm-loader.mjs')
    sinon.spy(loader.registeredSpecifiers, 'get')
  })

  t.test('resolve should exit early if agent is not running', async (t) => {
    delete mockedAgent.agent
    await loader.resolve('test-mod', {}, resolveStub)
    t.ok(
      mockedShimmer.getInstrumentationNameFromModuleName.notCalled,
      'should not have called getInstrumentationNameFromModuleName'
    )
  })

  t.test('resolve should exit early if the Node.js version is < 16.12.0', async (t) => {
    await loader.resolve('test-mod', {}, resolveStub)
    t.ok(
      mockedShimmer.getInstrumentationNameFromModuleName.notCalled,
      'should not have called getInstrumentationNameFromModuleName'
    )
  })

  t.test('load should exit early if agent is not running', async (t) => {
    delete mockedAgent.agent
    await loader.load('/path/to/test-mod.js?hasNrInstrumentation=true', {}, loadStub)
    t.equal(loader.registeredSpecifiers.get.callCount, 0, 'should have exited early')
    t.equal(loadStub.callCount, 1, 'should have called next loader')
  })

  t.test('load should exit early if the Node.js version is < 16.12.0', async (t) => {
    await loader.load('/path/to/test-mod.js?hasNrInstrumentation=true', {}, loadStub)
    t.equal(loader.registeredSpecifiers.get.callCount, 0, 'should have exited early')
    t.equal(loadStub.callCount, 1, 'should have called next loader')
  })

  t.test('should update the unsupported metric when on an unsupported version of node', (t) => {
    t.ok(
      fakeGetOrCreateMetric.calledOnceWithExactly('Supportability/Features/ESM/UnsupportedLoader'),
      'should get the correct usage metric'
    )
    t.equal(fakeIncrementCallCount.callCount, 1, 'should increment the metric')
    t.end()
  })
})
