/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import sinon from 'sinon'
import * as td from 'testdouble'
import semver from 'semver'
const isUnsupported = () => semver.lte(process.version, 'v16.12.0')

tap.test('ES Module Loader', { skip: isUnsupported() }, (t) => {
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

  t.beforeEach(async () => {
    fakeSpecifier = 'my-test-dep'
    fakeContext = {}
    fakeNextResolve = sinon.stub()

    fakeLoggerChild = {
      debug: sinon.stub()
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

    t.end()
  })

  t.test('should update the loader metric when on a supported version of node', async (t) => {
    t.ok(
      fakeGetOrCreateMetric.calledOnceWith('Supportability/Features/ESM/Loader'),
      'should get the correct usage metric'
    )
    t.equal(fakeIncrementCallCount.callCount, 1, 'should increment the metric')

    t.end()
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

    t.end()
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

    t.end()
  })

  t.test(
    'should noop if module we are resolving has instrumentation but is not commonjs',
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
        { url: 'file://path/to/my-test-dep/index.js', format: 'module' },
        'should return an object with url and format'
      )
      t.equal(fakeLoggerChild.debug.callCount, 2, 'should log two debug statements')
      t.ok(
        fakeLoggerChild.debug.calledWith('Instrumentation exists for my-test-dep'),
        'should log debug about instrumentation existing'
      )
      t.ok(
        fakeLoggerChild.debug.calledWith('my-test-dep is not a CommonJS module, skipping for now'),
        'should log debug about instrumentation not being commonjs'
      )
      t.ok(
        fakeShimmer.registerInstrumentation.notCalled,
        'should not have registered an instrumentation copy'
      )

      t.end()
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
        fakeLoggerChild.debug.calledWith('Instrumentation exists for my-test-dep'),
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

      t.end()
    }
  )
})

tap.test('Skipped ESM loader', { skip: !isUnsupported() }, (t) => {
  t.autoend()

  let mockedAgent = null
  let mockedShimmer = null
  let loader = null
  let resolveStub = null
  let fakeGetOrCreateMetric
  let fakeIncrementCallCount

  t.beforeEach(async () => {
    resolveStub = sinon.stub()

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
  })

  t.test('should exit early if agent is not running', async (t) => {
    delete mockedAgent.agent
    await loader.resolve('test-mod', {}, resolveStub)
    t.ok(
      mockedShimmer.getInstrumentationNameFromModuleName.notCalled,
      'should not have called getInstrumentationNameFromModuleName'
    )
  })

  t.test('should exit early if the Node.js version is < 16.12.0', async (t) => {
    await loader.resolve('test-mod', {}, resolveStub)
    t.ok(
      mockedShimmer.getInstrumentationNameFromModuleName.notCalled,
      'should not have called getInstrumentationNameFromModuleName'
    )
  })

  t.test(
    'should update the unsupported metric when on an unsupported version of node',
    async (t) => {
      t.ok(
        fakeGetOrCreateMetric.calledOnceWithExactly(
          'Supportability/Features/ESM/UnsupportedLoader'
        ),
        'should get the correct usage metric'
      )
      t.equal(fakeIncrementCallCount.callCount, 1, 'should increment the metric')

      t.end()
    }
  )
})
