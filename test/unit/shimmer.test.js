/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const oldInstrumentations = require('../../lib/instrumentations')
const insPath = require.resolve('../../lib/instrumentations')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../lib/agent_helper')
const logger = require('../../lib/logger').child({ component: 'TEST' })
const shimmer = require('../../lib/shimmer')
const shims = require('../../lib/shim')
const EventEmitter = require('events').EventEmitter
const symbols = require('../../lib/symbols')

const TEST_MODULE_PATH = 'test-mod/module'
const TEST_MODULE_RELATIVE_PATH = `../helpers/node_modules/${TEST_MODULE_PATH}`
const TEST_MODULE = 'sinon'
const TEST_PATH_WITHIN = `${TEST_MODULE}/lib/sinon/spy`

async function makeModuleTests({ moduleName, relativePath, throwsError }, t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.counter = 0
    ctx.nr.errorThrown = 0
    ctx.nr.agent = helper.instrumentMockedAgent()
    const instrumentationOpts = {
      moduleName,
      onRequire: function (shim, module) {
        ctx.nr.instrumentedModule = module
        ++ctx.nr.counter
        ctx.nr.onRequireArgs = arguments
        if (throwsError) {
          ctx.nr.expectedErr = 'This threw an error! Oh no!'
          throw new Error(ctx.nr.expectedErr)
        }
      },
      onError: function (err) {
        if (err.message === ctx.nr.expectedErr) {
          ctx.nr.errorThrown += 1
        }
      }
    }
    shimmer.registerInstrumentation(instrumentationOpts)
  })

  t.afterEach(function (ctx) {
    ctx.nr.onRequireArgs = null

    clearCachedModules([relativePath])

    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should be sent a shim and the loaded module', function (t) {
    const mod = require(relativePath)
    const { onRequireArgs } = t.nr
    assert.equal(onRequireArgs.length, 3)
    assert.ok(onRequireArgs[0] instanceof shims.Shim)
    assert.equal(onRequireArgs[1], mod)
    assert.equal(onRequireArgs[2], moduleName)
  })

  await t.test('should construct a DatastoreShim if the type is "datastore"', function (t) {
    shimmer.registeredInstrumentations.getAllByName(moduleName)[0].instrumentation.type =
      'datastore'
    require(relativePath)
    const { onRequireArgs } = t.nr
    assert.ok(onRequireArgs[0] instanceof shims.DatastoreShim)
  })

  await t.test('should receive the correct module (' + moduleName + ')', function (t) {
    const mod = require(relativePath)
    assert.equal(mod, t.nr.instrumentedModule)
  })

  await t.test('should only run the instrumentation once', function (t) {
    assert.equal(t.nr.counter, 0)
    require(relativePath)
    assert.equal(t.nr.counter, 1)
    require(relativePath)
    require(relativePath)
    require(relativePath)
    require(relativePath)
    assert.equal(t.nr.counter, 1)
  })

  await t.test('should have some NR properties after instrumented', () => {
    const mod = require(relativePath)
    const nrKeys = getNRSymbols(mod)

    const message = `Expected to have Symbol(shim) but found ${nrKeys}.`
    assert.ok(nrKeys.includes('Symbol(shim)'), message)
  })

  await t.test('should clean up NR added properties', () => {
    const mod = require(relativePath)
    shimmer.unwrapAll()
    const nrKeys = getNRSymbols(mod)

    const message = `Expected keys to be equal but found: ${JSON.stringify(nrKeys)}`
    assert.equal(nrKeys.length, 0, message)
  })

  if (throwsError) {
    await t.test('should send error to onError handler', (t) => {
      require(relativePath)
      assert.equal(t.nr.errorThrown, 1)
    })
  }
}

test('shimmer', async function (t) {
  await t.test('custom instrumentation', async function (t) {
    await t.test(
      'of relative modules',
      makeModuleTests.bind(this, {
        moduleName: TEST_MODULE_PATH,
        relativePath: TEST_MODULE_RELATIVE_PATH
      })
    )
    await t.test(
      'of modules',
      makeModuleTests.bind(this, { moduleName: TEST_MODULE, relativePath: TEST_MODULE })
    )
    await t.test(
      'of modules, where instrumentation fails',
      makeModuleTests.bind(this, {
        moduleName: TEST_MODULE,
        relativePath: TEST_MODULE,
        throwsError: true
      })
    )
    await t.test(
      'of deep modules',
      makeModuleTests.bind(this, { moduleName: TEST_PATH_WITHIN, relativePath: TEST_PATH_WITHIN })
    )
  })

  await t.test('wrapping exports', async function (t) {
    t.beforeEach(function (ctx) {
      ctx.nr = {}
      ctx.nr.agent = helper.instrumentMockedAgent()
      shimmer.registerInstrumentation({
        moduleName: TEST_MODULE_PATH,
        onRequire: function (shim, nodule) {
          const original = nodule
          const wrapper = {}

          shim.wrapExport(original, function () {
            return wrapper
          })
          ctx.nr.wrapper = wrapper
          ctx.nr.original = original
        }
      })
    })

    t.afterEach(function (ctx) {
      helper.unloadAgent(ctx.nr.agent)
      clearCachedModules([TEST_MODULE_RELATIVE_PATH])
    })

    await t.test('should replace the return value from require', function (t) {
      const obj = require(TEST_MODULE_RELATIVE_PATH)
      const { wrapper, original } = t.nr
      assert.equal(obj, wrapper)
      assert.notDeepEqual(obj, original)
    })
  })

  await t.test('the instrumentation injector', async function (t) {
    const nodule = {
      c: 2,
      ham: 'ham',
      doubler: function (x, cb) {
        cb(this.c + x * 2)
      },
      tripler: function (y, cb) {
        cb(this.c + y * 3)
      },
      quadrupler: function (z, cb) {
        cb(this.c + z * 4)
      },
      hammer: function (h, cb) {
        cb(this.ham + h)
      }
    }

    await t.test('should not wrap anything without enough information', () => {
      shimmer.wrapMethod(nodule, 'nodule')
      assert.equal(shimmer.isWrapped(nodule.doubler), false)
      shimmer.wrapMethod(nodule, 'nodule', 'doubler')
      assert.equal(shimmer.isWrapped(nodule.doubler), false)
    })

    await t.test('should wrap a method', function () {
      let doubled = 0
      let before = false
      let after = false

      shimmer.wrapMethod(nodule, 'nodule', 'doubler', function (original) {
        return function () {
          before = true
          original.apply(this, arguments)
          after = true
        }
      })

      assert.equal(shimmer.isWrapped(nodule.doubler), true)
      assert.ok(typeof nodule.doubler[symbols.unwrap] === 'function')

      nodule.doubler(7, function (z) {
        doubled = z
      })

      assert.equal(doubled, 16)
      assert.equal(before, true)
      assert.equal(after, true)
    })

    await t.test('should preserve properties on wrapped methods', () => {
      let quadrupled = 0
      let before = false
      let after = false

      nodule.quadrupler.test = () => {}

      shimmer.wrapMethod(nodule, 'nodule', 'quadrupler', function (original) {
        return function () {
          before = true
          original.apply(this, arguments)
          after = true
        }
      })

      assert.ok(typeof nodule.quadrupler[symbols.unwrap] === 'function')
      assert.ok(typeof nodule.quadrupler.test === 'function')

      nodule.quadrupler(7, function (z) {
        quadrupled = z
      })

      assert.equal(quadrupled, 30)
      assert.equal(before, true)
      assert.equal(after, true)
    })

    await t.test('should not error out on external instrumentations that fail', function (t) {
      t.after(() => {
        require.cache[insPath].exports = oldInstrumentations
      })

      require.cache[insPath].exports = wrappedInst
      function wrappedInst() {
        const ret = oldInstrumentations()
        ret['../lib/broken_instrumentation_module'] = {
          module: '../test/lib/broken_instrumentation_module'
        }
        return ret
      }
      assert.doesNotThrow(function () {
        require('../lib/broken_instrumentation_module')
      })
    })

    await t.test('with accessor replacement', async function (t) {
      t.beforeEach(function (ctx) {
        ctx.nr = {}
        ctx.nr.simple = { target: true }
      })

      await t.test("shouldn't throw if called with no params", function () {
        assert.doesNotThrow(function () {
          shimmer.wrapDeprecated()
        })
      })

      await t.test("shouldn't throw if called with only the original object", function (t) {
        const { simple } = t.nr
        assert.doesNotThrow(function () {
          shimmer.wrapDeprecated(simple)
        })
      })

      await t.test("shouldn't throw if property to be replaced is omitted", function (t) {
        const { simple } = t.nr
        assert.doesNotThrow(function () {
          shimmer.wrapDeprecated(simple, 'nodule', null, {
            get: function () {},
            set: function () {}
          })
        })
      })

      await t.test("shouldn't throw if getter is omitted", function (t) {
        const { simple } = t.nr
        assert.doesNotThrow(function () {
          shimmer.wrapDeprecated(simple, 'nodule', 'target', { set: function () {} })
        })
      })

      await t.test("shouldn't throw if setter is omitted", function (t) {
        const { simple } = t.nr
        assert.doesNotThrow(function () {
          shimmer.wrapDeprecated(simple, 'nodule', 'target', { get: function () {} })
        })
      })

      await t.test('should replace a property with an accessor', function (t) {
        const { simple } = t.nr
        shimmer.debug = true // test internal debug code
        const original = shimmer.wrapDeprecated(simple, 'nodule', 'target', {
          get: function () {
            // test will only complete if this is called
            return false
          }
        })
        assert.equal(original, true)

        assert.equal(simple.target, false)
        // internal debug code should unwrap
        assert.doesNotThrow(shimmer.unwrapAll)
      })

      await t.test('should invoke the setter when the accessor is used', function (t, end) {
        const { simple } = t.nr
        const test = 'ham'
        const original = shimmer.wrapDeprecated(simple, 'nodule', 'target', {
          get: function () {
            return test
          },
          set: function (value) {
            assert.equal(value, 'eggs')
            end()
          }
        })
        assert.equal(original, true)
        assert.equal(simple.target, 'ham')
        simple.target = 'eggs'
      })
    })

    await t.test('should wrap, then unwrap a method', function () {
      let tripled = 0
      let before = false
      let after = false

      shimmer.wrapMethod(nodule, 'nodule', 'tripler', function (original) {
        return function () {
          before = true
          original.apply(this, arguments)
          after = true
        }
      })

      nodule.tripler(7, function (z) {
        tripled = z
      })

      assert.equal(tripled, 23)
      assert.equal(before, true)
      assert.equal(after, true)

      before = false
      after = false

      shimmer.unwrapMethod(nodule, 'nodule', 'tripler')

      nodule.tripler(9, function (j) {
        tripled = j
      })

      assert.equal(tripled, 29)
      assert.equal(before, false)
      assert.equal(after, false)
    })

    await t.test(
      "shouldn't break anything when an NR-wrapped method is wrapped again",
      function () {
        let hamceptacle = ''
        let before = false
        let after = false
        let hammed = false

        shimmer.wrapMethod(nodule, 'nodule', 'hammer', function (original) {
          return function () {
            before = true
            original.apply(this, arguments)
            after = true
          }
        })

        // monkey-patching the old-fashioned way
        const hammer = nodule.hammer
        nodule.hammer = function () {
          hammer.apply(this, arguments)
          hammed = true
        }

        nodule.hammer('Burt', function (k) {
          hamceptacle = k
        })

        assert.equal(hamceptacle, 'hamBurt')
        assert.equal(before, true)
        assert.equal(after, true)
        assert.equal(hammed, true)
      }
    )

    await t.test('with full instrumentation running', async function (t) {
      t.beforeEach(function (ctx) {
        ctx.nr = {}
        ctx.nr.agent = helper.loadMockedAgent()
      })

      t.afterEach(function (ctx) {
        helper.unloadAgent(ctx.nr.agent)
      })

      await t.test('should push transactions through process.nextTick', async function (t) {
        const plan = tspl(t, { plan: 31 })
        const { agent } = t.nr
        plan.equal(agent.getTransaction(), null)

        const synchronizer = new EventEmitter()
        const transactions = []
        const ids = []

        const spamTransaction = function (i) {
          const wrapped = agent.tracer.transactionProxy(function transactionProxyCb() {
            const current = agent.getTransaction()
            transactions[i] = current
            ids[i] = current.id

            const ctx = agent.tracer.getContext()
            process.nextTick(
              agent.tracer.bindFunction(function bindFunctionCb() {
                const lookup = agent.getTransaction()
                plan.equal(lookup, current)

                synchronizer.emit('inner', lookup, i)
              }, ctx)
            )
          })
          wrapped()
        }

        synchronizer.on('inner', function (trans, j) {
          plan.equal(trans, transactions[j])
          plan.equal(trans.id, ids[j])
          trans.end()
        })

        for (let i = 0; i < 10; i += 1) {
          process.nextTick(spamTransaction.bind(this, i))
        }
        await plan.completed
      })

      await t.test('should push transactions through setTimeout', async function (t) {
        const plan = tspl(t, { plan: 31 })
        const { agent } = t.nr
        plan.equal(agent.getTransaction(), null)

        const synchronizer = new EventEmitter()
        const transactions = []
        const ids = []

        const spamTransaction = function (i) {
          const wrapped = agent.tracer.transactionProxy(function transactionProxyCb() {
            const current = agent.getTransaction()
            transactions[i] = current
            ids[i] = current.id

            const ctx = agent.tracer.getContext()
            setTimeout(
              agent.tracer.bindFunction(function bindFunctionCb() {
                const lookup = agent.getTransaction()
                plan.equal(lookup, current)

                synchronizer.emit('inner', lookup, i)
              }, ctx),
              1
            )
          })
          wrapped()
        }

        synchronizer.on('inner', function (trans, j) {
          plan.equal(trans, transactions[j])
          plan.equal(trans.id, ids[j])
          trans.end()
        })

        for (let i = 0; i < 10; i += 1) {
          // You know what this test needs? Some non-determinism!
          const timeout = Math.floor(Math.random() * 20)
          setTimeout(spamTransaction.bind(this, i), timeout)
        }
        await plan.completed
      })

      await t.test('should push transactions through EventEmitters', async function (t) {
        const plan = tspl(t, { plan: 41 })
        const { agent } = t.nr
        plan.equal(agent.getTransaction(), null)

        const eventer = new EventEmitter()
        const transactions = []
        const ids = []

        const eventTransaction = function (j) {
          const wrapped = agent.tracer.transactionProxy(function transactionProxyCb() {
            const current = agent.getTransaction()
            const id = current.id
            const name = 'ttest' + (j + 1)

            transactions[j] = current
            ids[j] = id

            const ctx = agent.tracer.getContext()
            eventer.on(
              name,
              agent.tracer.bindFunction(function bindFunctionCb() {
                const lookup = agent.getTransaction()
                plan.equal(lookup, current)
                plan.equal(lookup.id, id)

                eventer.emit('inner', lookup, j)
              }, ctx)
            )

            eventer.emit(name)
          })
          wrapped()
        }

        eventer.on('inner', function (trans, j) {
          plan.equal(trans, transactions[j])
          plan.equal(trans.id, ids[j])

          trans.end()
        })

        for (let i = 0; i < 10; i += 1) {
          eventTransaction(i)
        }
        await plan.completed
      })

      await t.test(
        'should handle whatever ridiculous nonsense you throw at it',
        async function (t) {
          const plan = tspl(t, { plan: 171 })
          const { agent } = t.nr
          plan.equal(agent.getTransaction(), null)

          const synchronizer = new EventEmitter()
          const eventer = new EventEmitter()
          const transactions = []
          const ids = []

          const verify = function (i, phase, passed) {
            const lookup = agent.getTransaction()
            logger.trace(
              '%d %s %d %d',
              i,
              phase,
              lookup ? lookup.id : 'missing',
              passed ? passed.id : 'missing'
            )

            plan.equal(lookup, passed)
            plan.equal(lookup, transactions[i])
            plan.equal(lookup.id, ids[i])
          }

          eventer.on('rntest', function (trans, j) {
            verify(j, 'eventer', trans)
            synchronizer.emit('inner', trans, j)
          })

          const createTimer = function (trans, j) {
            const wrapped = agent.tracer.wrapFunctionFirst('createTimer', null, process.nextTick)

            wrapped(function () {
              const current = agent.getTransaction()

              verify(j, 'createTimer', current)
              eventer.emit('rntest', current, j)
            })
          }

          const createTicker = function (j) {
            return agent.tracer.transactionProxy(function transactionProxyCb() {
              const current = agent.getTransaction()
              transactions[j] = current
              ids[j] = current.id

              verify(j, 'createTicker', current)

              const ctx = agent.tracer.getContext()
              process.nextTick(
                agent.tracer.bindFunction(function bindFunctionCb() {
                  verify(j, 'nextTick', current)
                  createTimer(current, j)
                }, ctx)
              )
            })
          }

          synchronizer.on('inner', function (trans, j) {
            verify(j, 'synchronizer', trans)
            plan.equal(trans, transactions[j])
            plan.equal(trans.id, ids[j])
            trans.end()
          })

          for (let i = 0; i < 10; i++) {
            process.nextTick(createTicker(i))
          }
          await plan.completed
        }
      )
    })
  })
})

test('Should not augment module when no instrumentation hooks provided', async (t) => {
  const agent = helper.instrumentMockedAgent()

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const instrumentationOpts = {
    moduleName: TEST_MODULE_PATH,
    onError: () => {}
  }
  shimmer.registerInstrumentation(instrumentationOpts)

  const loadedModule = require(TEST_MODULE_RELATIVE_PATH)

  assert.equal(loadedModule.foo, 'bar')

  // Future proofing to catch any added symbols. If test  module modified to add own symbol
  // will have to filter out here.
  const nrSymbols = Object.getOwnPropertySymbols(loadedModule)

  assert.equal(
    nrSymbols.length,
    0,
    `should not have NR symbols but found: ${JSON.stringify(nrSymbols)}`
  )
})

test('Should not crash on empty instrumentation registration', async (t) => {
  const agent = helper.instrumentMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  assert.doesNotThrow(shimmer.registerInstrumentation)
})

test('Should not register instrumentation with no name provided', async (t) => {
  const agent = helper.instrumentMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  shimmer.registerInstrumentation({})

  assert.ok(!shimmer.registeredInstrumentations.undefined)
})

test('Should not register when no hooks provided', async (t) => {
  const agent = helper.instrumentMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  const moduleName = 'test name'
  shimmer.registerInstrumentation({
    moduleName
  })

  assert.ok(!shimmer.registeredInstrumentations[moduleName])
})

test('should register hooks for ritm and iitm', async () => {
  const fakeAgent = {}
  shimmer.registerHooks(fakeAgent)
  assert.ok(shimmer._ritm, 'should have ritm instance')
  assert.ok(shimmer._iitm, 'should have iitm instance')
})

test('should unhook ritm and iitm when calling removeHooks', async () => {
  const fakeAgent = {}
  shimmer.registerHooks(fakeAgent)
  assert.ok(shimmer._ritm, 'should have ritm instance')
  assert.ok(shimmer._iitm, 'should have iitm instance')
  shimmer.removeHooks()
  assert.ok(!shimmer._iitm, 'should unhook iitm')
  assert.ok(!shimmer._ritm, 'should unhook ritm')
})

test('should not throw if you call removeHooks before creating ritm and iitm hooks', async () => {
  assert.doesNotThrow(() => {
    shimmer.removeHooks()
  })
})

test('Shimmer with logger mock', async (t) => {
  const sandbox = sinon.createSandbox()
  const loggerMock = require('./mocks/logger')(sandbox)
  const shimmer = proxyquire('../../lib/shimmer', {
    './logger': {
      child: sandbox.stub().callsFake(() => loggerMock)
    }
  })

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({}, true, shimmer)
  })

  t.afterEach((ctx) => {
    sandbox.resetHistory()
    clearCachedModules([TEST_MODULE_RELATIVE_PATH])
    helper.unloadAgent(ctx.nr.agent, shimmer)
  })

  await t.test('should log warning when onError hook throws', () => {
    const origError = new Error('failed to instrument')
    const instFail = new Error('Failed to handle instrumentation error')
    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onRequire: () => {
        throw origError
      },
      onError: () => {
        throw instFail
      }
    })

    require(TEST_MODULE_RELATIVE_PATH)
    assert.deepEqual(loggerMock.warn.args[0], [
      instFail,
      origError,
      'Custom instrumentation for %s failed, then the onError handler threw an error',
      TEST_MODULE_PATH
    ])
  })

  await t.test('should log warning when instrumentation fails and no onError handler', () => {
    const origError = new Error('failed to instrument')
    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onRequire: () => {
        throw origError
      }
    })

    require(TEST_MODULE_RELATIVE_PATH)
    assert.deepEqual(loggerMock.warn.args[0], [
      origError,
      'Custom instrumentation for %s failed. Please report this to the maintainers of the custom instrumentation.',
      TEST_MODULE_PATH
    ])
  })

  await t.test(
    'should skip instrumentation if hooks for the same package version have already run',
    () => {
      const opts = {
        moduleName: TEST_MODULE_PATH,
        onRequire: () => {}
      }

      shimmer.registerInstrumentation(opts)
      require(TEST_MODULE_RELATIVE_PATH)
      clearCachedModules([TEST_MODULE_RELATIVE_PATH])
      require(TEST_MODULE_RELATIVE_PATH)
      assert.deepEqual(loggerMock.trace.args[2], [
        'Already instrumented test-mod/module@0.0.1, skipping registering instrumentation'
      ])
    }
  )

  await t.test(
    'should skip instrumentation if hooks for the same package version have already errored',
    () => {
      const opts = {
        moduleName: TEST_MODULE_PATH,
        onRequire: () => {
          throw new Error('test')
        }
      }

      shimmer.registerInstrumentation(opts)
      require(TEST_MODULE_RELATIVE_PATH)
      clearCachedModules([TEST_MODULE_RELATIVE_PATH])
      require(TEST_MODULE_RELATIVE_PATH)
      assert.deepEqual(loggerMock.trace.args[2], [
        'Failed to instrument test-mod/module@0.0.1, skipping registering instrumentation'
      ])
    }
  )

  await t.test('should return package version from package.json', () => {
    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onRequire: () => {}
    })

    require(TEST_MODULE_RELATIVE_PATH)
    const version = shimmer.getPackageVersion(TEST_MODULE_PATH)
    const found = loggerMock.debug.args.find(debugArgs => debugArgs?.[0]?.includes('Failed to get version for `%s`, reason: %s'))
    assert.equal(undefined, found)
    assert.equal(version, '0.0.1', 'should get package version from package.json')
  })

  await t.test(
    'should return Node.js version when it cannot obtain package version from package.json',
    () => {
      const version = shimmer.getPackageVersion('bogus')
      assert.equal(version, process.version)
      assert.deepEqual(loggerMock.debug.args[loggerMock.debug.args.length - 1], [
        'Failed to get version for `%s`, reason: %s',
        'bogus',
        "no tracked items for module 'bogus'"
      ])
    }
  )
})

test('Shimmer subscriber setup/teardown', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const sandbox = sinon.createSandbox()
    const loggerMock = require('./mocks/logger')(sandbox)
    const shimmer = proxyquire('../../lib/shimmer', {
      './logger': {
        child: sandbox.stub().callsFake(() => loggerMock)
      }
    })
    const agent = helper.loadMockedAgent({}, true)
    agent.config.instrumentation.pino.enabled = false
    agent.config.instrumentation.ioredis.enabled = true
    ctx.nr = {
      agent,
      sandbox,
      shimmer,
      loggerMock
    }
  })

  t.afterEach((ctx) => {
    const { agent, sandbox, shimmer } = ctx.nr
    sandbox.restore()
    clearCachedModules([TEST_MODULE_RELATIVE_PATH])
    helper.unloadAgent(agent, shimmer)
  })

  await t.test('should setup subscribers that are enabled', (t) => {
    const { agent, shimmer } = t.nr
    assert.ok(!shimmer._subscribers, 'should not have subscribers before setup')
    shimmer.setupSubscribers(agent)
    assert.ok(!shimmer._subscribers['orchestrion:pino:nr_asJson'])
    assert.ok(shimmer._subscribers['orchestrion:ioredis:nr_sendCommand'])
  })

  await t.test('should teardown subscribers that are enabled', (t) => {
    const { agent, shimmer } = t.nr
    assert.ok(!shimmer._subscribers, 'should not have subscribers before setup')
    shimmer.setupSubscribers(agent)
    shimmer.teardownSubscribers()
    assert.deepEqual(shimmer._subscribers, {}, 'should not have subscribers after teardown')
  })
})

function clearCachedModules(modules) {
  modules.forEach((moduleName) => {
    try {
      const requirePath = require.resolve(moduleName)
      delete require.cache[requirePath]
      return true
    } catch {
      return false
    }
  })
}

function getNRSymbols(thing) {
  const knownSymbols = Object.values(symbols)
  return Object.getOwnPropertySymbols(thing)
    .filter((key) => knownSymbols.includes(key))
    .map((key) => key.toString())
}
