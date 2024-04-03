/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const oldInstrumentations = require('../../lib/instrumentations')
const insPath = require.resolve('../../lib/instrumentations')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

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

function makeModuleTests({ moduleName, relativePath, throwsError }, t) {
  t.autoend()
  t.beforeEach(function (t) {
    t.context.counter = 0
    t.context.errorThrown = 0
    t.context.agent = helper.instrumentMockedAgent()
    const instrumentationOpts = {
      moduleName: moduleName,
      onRequire: function (shim, module) {
        t.context.instrumentedModule = module
        ++t.context.counter
        t.context.onRequireArgs = arguments
        if (throwsError) {
          t.context.expectedErr = 'This threw an error! Oh no!'
          throw new Error(t.context.expectedErr)
        }
      },
      onError: function (err) {
        if (err.message === t.context.expectedErr) {
          t.context.errorThrown += 1
        }
      }
    }
    shimmer.registerInstrumentation(instrumentationOpts)
  })

  t.afterEach(function (t) {
    t.context.onRequireArgs = null

    clearCachedModules([relativePath])

    helper.unloadAgent(t.context.agent)
  })

  t.test('should be sent a shim and the loaded module', function (t) {
    const mod = require(relativePath)
    const { onRequireArgs } = t.context
    t.equal(onRequireArgs.length, 3)
    t.ok(onRequireArgs[0] instanceof shims.Shim)
    t.equal(onRequireArgs[1], mod)
    t.equal(onRequireArgs[2], moduleName)
    t.end()
  })

  t.test('should construct a DatastoreShim if the type is "datastore"', function (t) {
    shimmer.registeredInstrumentations.getAllByName(moduleName)[0].instrumentation.type =
      'datastore'
    require(relativePath)
    const { onRequireArgs } = t.context
    t.ok(onRequireArgs[0] instanceof shims.DatastoreShim)
    t.end()
  })

  t.test('should receive the correct module (' + moduleName + ')', function (t) {
    const mod = require(relativePath)
    t.equal(mod, t.context.instrumentedModule)
    t.end()
  })

  t.test('should only run the instrumentation once', function (t) {
    t.equal(t.context.counter, 0)
    require(relativePath)
    t.equal(t.context.counter, 1)
    require(relativePath)
    require(relativePath)
    require(relativePath)
    require(relativePath)
    t.equal(t.context.counter, 1)
    t.end()
  })

  t.test('should have some NR properties after instrumented', (t) => {
    const mod = require(relativePath)
    const nrKeys = getNRSymbols(mod)

    const message = `Expected to have Symbol(shim) but found ${nrKeys}.`
    t.ok(nrKeys.includes('Symbol(shim)'), message)
    t.end()
  })

  t.test('should clean up NR added properties', (t) => {
    const mod = require(relativePath)
    shimmer.unwrapAll()
    const nrKeys = getNRSymbols(mod)

    const message = `Expected keys to be equal but found: ${JSON.stringify(nrKeys)}`
    t.equal(nrKeys.length, 0, message)
    t.end()
  })

  if (throwsError) {
    t.test('should send error to onError handler', (t) => {
      require(relativePath)
      t.equal(t.context.errorThrown, 1)
      t.end()
    })
  }
}

tap.test('shimmer', function (t) {
  t.autoend()
  t.test('custom instrumentation', function (t) {
    t.autoend()
    t.test(
      'of relative modules',
      makeModuleTests.bind(this, {
        moduleName: TEST_MODULE_PATH,
        relativePath: TEST_MODULE_RELATIVE_PATH
      })
    )
    t.test(
      'of modules',
      makeModuleTests.bind(this, { moduleName: TEST_MODULE, relativePath: TEST_MODULE })
    )
    t.test(
      'of modules, where instrumentation fails',
      makeModuleTests.bind(this, {
        moduleName: TEST_MODULE,
        relativePath: TEST_MODULE,
        throwsError: true
      })
    )
    t.test(
      'of deep modules',
      makeModuleTests.bind(this, { moduleName: TEST_PATH_WITHIN, relativePath: TEST_PATH_WITHIN })
    )
  })

  t.test('wrapping exports', function (t) {
    t.autoend()
    t.beforeEach(function (t) {
      t.context.agent = helper.instrumentMockedAgent()
      shimmer.registerInstrumentation({
        moduleName: TEST_MODULE_PATH,
        onRequire: function (shim, nodule) {
          const original = nodule
          const wrapper = {}

          shim.wrapExport(original, function () {
            return wrapper
          })
          t.context.wrapper = wrapper
          t.context.original = original
        }
      })
    })

    t.afterEach(function (t) {
      helper.unloadAgent(t.context.agent)
      clearCachedModules([TEST_MODULE_RELATIVE_PATH])
    })

    t.test('should replace the return value from require', function (t) {
      const obj = require(TEST_MODULE_RELATIVE_PATH)
      const { wrapper, original } = t.context
      t.equal(obj, wrapper)
      t.not(obj, original)
      t.end()
    })
  })

  t.test('the instrumentation injector', function (t) {
    t.autoend()
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

    t.test('should not wrap anything without enough information', (t) => {
      shimmer.wrapMethod(nodule, 'nodule')
      t.equal(shimmer.isWrapped(nodule.doubler), false)
      shimmer.wrapMethod(nodule, 'nodule', 'doubler')
      t.equal(shimmer.isWrapped(nodule.doubler), false)
      t.end()
    })

    t.test('should wrap a method', function (t) {
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

      t.equal(shimmer.isWrapped(nodule.doubler), true)
      t.ok(typeof nodule.doubler[symbols.unwrap] === 'function')

      nodule.doubler(7, function (z) {
        doubled = z
      })

      t.equal(doubled, 16)
      t.equal(before, true)
      t.equal(after, true)
      t.end()
    })

    t.test('should preserve properties on wrapped methods', (t) => {
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

      t.ok(typeof nodule.quadrupler[symbols.unwrap] === 'function')
      t.ok(typeof nodule.quadrupler.test === 'function')

      nodule.quadrupler(7, function (z) {
        quadrupled = z
      })

      t.equal(quadrupled, 30)
      t.equal(before, true)
      t.equal(after, true)
      t.end()
    })

    t.test('should not error out on external instrumentations that fail', function (t) {
      t.teardown(() => {
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
      t.doesNotThrow(function () {
        require('../lib/broken_instrumentation_module')
      })
      t.end()
    })

    t.test('with accessor replacement', function (t) {
      t.autoend()

      t.beforeEach(function (t) {
        t.context.simple = { target: true }
      })

      t.test("shouldn't throw if called with no params", function (t) {
        t.doesNotThrow(function () {
          shimmer.wrapDeprecated()
        })
        t.end()
      })

      t.test("shouldn't throw if called with only the original object", function (t) {
        const { simple } = t.context
        t.doesNotThrow(function () {
          shimmer.wrapDeprecated(simple)
        })
        t.end()
      })

      t.test("shouldn't throw if property to be replaced is omitted", function (t) {
        const { simple } = t.context
        t.doesNotThrow(function () {
          shimmer.wrapDeprecated(simple, 'nodule', null, {
            get: function () {},
            set: function () {}
          })
        })
        t.end()
      })

      t.test("shouldn't throw if getter is omitted", function (t) {
        const { simple } = t.context
        t.doesNotThrow(function () {
          shimmer.wrapDeprecated(simple, 'nodule', 'target', { set: function () {} })
        })
        t.end()
      })

      t.test("shouldn't throw if setter is omitted", function (t) {
        const { simple } = t.context
        t.doesNotThrow(function () {
          shimmer.wrapDeprecated(simple, 'nodule', 'target', { get: function () {} })
        })
        t.end()
      })

      t.test('should replace a property with an accessor', function (t) {
        const { simple } = t.context
        shimmer.debug = true // test internal debug code
        const original = shimmer.wrapDeprecated(simple, 'nodule', 'target', {
          get: function () {
            // test will only complete if this is called
            return false
          }
        })
        t.equal(original, true)

        t.equal(simple.target, false)
        // internal debug code should unwrap
        t.doesNotThrow(shimmer.unwrapAll)
        t.end()
      })

      t.test('should invoke the setter when the accessor is used', function (t) {
        const { simple } = t.context
        const test = 'ham'
        const original = shimmer.wrapDeprecated(simple, 'nodule', 'target', {
          get: function () {
            return test
          },
          set: function (value) {
            t.equal(value, 'eggs')
            t.end()
          }
        })
        t.equal(original, true)
        t.equal(simple.target, 'ham')
        simple.target = 'eggs'
      })
    })

    t.test('should wrap, then unwrap a method', function (t) {
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

      t.equal(tripled, 23)
      t.equal(before, true)
      t.equal(after, true)

      before = false
      after = false

      shimmer.unwrapMethod(nodule, 'nodule', 'tripler')

      nodule.tripler(9, function (j) {
        tripled = j
      })

      t.equal(tripled, 29)
      t.equal(before, false)
      t.equal(after, false)
      t.end()
    })

    t.test("shouldn't break anything when an NR-wrapped method is wrapped again", function (t) {
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

      t.equal(hamceptacle, 'hamBurt')
      t.equal(before, true)
      t.equal(after, true)
      t.equal(hammed, true)
      t.end()
    })

    t.test('with full instrumentation running', function (t) {
      t.autoend()

      t.beforeEach(function (t) {
        t.context.agent = helper.loadMockedAgent()
      })

      t.afterEach(function (t) {
        helper.unloadAgent(t.context.agent)
      })

      t.test('should push transactions through process.nextTick', function (t) {
        const { agent } = t.context
        t.equal(agent.getTransaction(), null)

        const synchronizer = new EventEmitter()
        const transactions = []
        const ids = []

        const spamTransaction = function (i) {
          const wrapped = agent.tracer.transactionProxy(function transactionProxyCb() {
            const current = agent.getTransaction()
            transactions[i] = current
            ids[i] = current.id

            process.nextTick(
              agent.tracer.bindFunction(function bindFunctionCb() {
                const lookup = agent.getTransaction()
                t.equal(lookup, current)

                synchronizer.emit('inner', lookup, i)
              })
            )
          })
          wrapped()
        }

        let doneCount = 0
        synchronizer.on('inner', function (trans, j) {
          doneCount += 1
          t.equal(trans, transactions[j])
          t.equal(trans.id, ids[j])

          trans.end()

          if (doneCount === 10) {
            t.end()
          }
        })

        for (let i = 0; i < 10; i += 1) {
          process.nextTick(spamTransaction.bind(this, i))
        }
      })

      t.test('should push transactions through setTimeout', function (t) {
        const { agent } = t.context
        t.equal(agent.getTransaction(), null)

        const synchronizer = new EventEmitter()
        const transactions = []
        const ids = []

        const spamTransaction = function (i) {
          const wrapped = agent.tracer.transactionProxy(function transactionProxyCb() {
            const current = agent.getTransaction()
            transactions[i] = current
            ids[i] = current.id

            setTimeout(
              agent.tracer.bindFunction(function bindFunctionCb() {
                const lookup = agent.getTransaction()
                t.equal(lookup, current)

                synchronizer.emit('inner', lookup, i)
              }),
              1
            )
          })
          wrapped()
        }

        let doneCount = 0
        synchronizer.on('inner', function (trans, j) {
          doneCount += 1
          t.equal(trans, transactions[j])
          t.equal(trans.id, ids[j])

          trans.end()

          if (doneCount === 10) {
            t.end()
          }
        })

        for (let i = 0; i < 10; i += 1) {
          // You know what this test needs? Some non-determinism!
          const timeout = Math.floor(Math.random() * 20)
          setTimeout(spamTransaction.bind(this, i), timeout)
        }
      })

      t.test('should push transactions through EventEmitters', function (t) {
        const { agent } = t.context
        t.equal(agent.getTransaction(), null)

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

            eventer.on(
              name,
              agent.tracer.bindFunction(function bindFunctionCb() {
                const lookup = agent.getTransaction()
                t.equal(lookup, current)
                t.equal(lookup.id, id)

                eventer.emit('inner', lookup, j)
              })
            )

            eventer.emit(name)
          })
          wrapped()
        }

        let doneCount = 0
        eventer.on('inner', function (trans, j) {
          doneCount += 1
          t.equal(trans, transactions[j])
          t.equal(trans.id, ids[j])

          trans.end()

          if (doneCount === 10) {
            t.end()
          }
        })

        for (let i = 0; i < 10; i += 1) {
          eventTransaction(i)
        }
      })

      t.test('should handle whatever ridiculous nonsense you throw at it', function (t) {
        const { agent } = t.context
        t.equal(agent.getTransaction(), null)

        const synchronizer = new EventEmitter()
        const eventer = new EventEmitter()
        const transactions = []
        const ids = []
        let doneCount = 0

        const verify = function (i, phase, passed) {
          const lookup = agent.getTransaction()
          logger.trace(
            '%d %s %d %d',
            i,
            phase,
            lookup ? lookup.id : 'missing',
            passed ? passed.id : 'missing'
          )

          t.equal(lookup, passed)
          t.equal(lookup, transactions[i])
          t.equal(lookup.id, ids[i])
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

            process.nextTick(
              agent.tracer.bindFunction(function bindFunctionCb() {
                verify(j, 'nextTick', current)
                createTimer(current, j)
              })
            )
          })
        }

        synchronizer.on('inner', function (trans, j) {
          verify(j, 'synchronizer', trans)
          doneCount += 1
          t.equal(trans, transactions[j])
          t.equal(trans.id, ids[j])

          trans.end()

          if (doneCount === 10) {
            t.end()
          }
        })

        for (let i = 0; i < 10; i++) {
          process.nextTick(createTicker(i))
        }
      })
    })
  })
})

tap.test('Should not augment module when no instrumentation hooks provided', (t) => {
  const agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  const instrumentationOpts = {
    moduleName: TEST_MODULE_PATH,
    onError: () => {}
  }
  shimmer.registerInstrumentation(instrumentationOpts)

  const loadedModule = require(TEST_MODULE_RELATIVE_PATH)

  t.equal(loadedModule.foo, 'bar')

  // Future proofing to catch any added symbols. If test  module modified to add own symbol
  // will have to filter out here.
  const nrSymbols = Object.getOwnPropertySymbols(loadedModule)

  t.equal(nrSymbols.length, 0, `should not have NR symbols but found: ${JSON.stringify(nrSymbols)}`)

  t.end()
})

tap.test('Should not crash on empty instrumentation registration', (t) => {
  const agent = helper.instrumentMockedAgent()
  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  t.doesNotThrow(shimmer.registerInstrumentation)

  t.end()
})

tap.test('Should not register instrumentation with no name provided', (t) => {
  const agent = helper.instrumentMockedAgent()
  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  shimmer.registerInstrumentation({})

  t.notOk(shimmer.registeredInstrumentations.undefined)

  t.end()
})

tap.test('Should not register when no hooks provided', (t) => {
  const agent = helper.instrumentMockedAgent()
  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  const moduleName = 'test name'
  shimmer.registerInstrumentation({
    moduleName: moduleName
  })

  t.notOk(shimmer.registeredInstrumentations[moduleName])

  t.end()
})

tap.test('should register hooks for ritm and iitm', (t) => {
  const fakeAgent = {}
  shimmer.registerHooks(fakeAgent)
  t.ok(shimmer._ritm, 'should have ritm instance')
  t.ok(shimmer._iitm, 'should have iitm instance')
  t.end()
})

tap.test('should unhook ritm and iitm when calling removeHooks', (t) => {
  const fakeAgent = {}
  shimmer.registerHooks(fakeAgent)
  t.ok(shimmer._ritm, 'should have ritm instance')
  t.ok(shimmer._iitm, 'should have iitm instance')
  shimmer.removeHooks()
  t.notOk(shimmer._iitm, 'should unhook iitm')
  t.notOk(shimmer._ritm, 'should unhook ritm')
  t.end()
})

tap.test('should not throw if you call removeHooks before creating ritm and iitm hooks', (t) => {
  t.doesNotThrow(() => {
    shimmer.removeHooks()
  })
  t.end()
})

tap.test('Shimmer with logger mock', (t) => {
  t.autoend()
  let loggerMock
  let shimmer
  let sandbox
  let agent
  t.before(() => {
    sandbox = sinon.createSandbox()
    loggerMock = require('./mocks/logger')(sandbox)
    shimmer = proxyquire('../../lib/shimmer', {
      './logger': {
        child: sandbox.stub().callsFake(() => loggerMock)
      }
    })
  })

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({}, true, shimmer)
  })

  t.afterEach(() => {
    sandbox.resetHistory()
    clearCachedModules([TEST_MODULE_RELATIVE_PATH])
    helper.unloadAgent(agent, shimmer)
  })

  t.test('should log warning when onError hook throws', (t) => {
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
    t.same(loggerMock.warn.args[0], [
      instFail,
      origError,
      'Custom instrumentation for %s failed, then the onError handler threw an error',
      TEST_MODULE_PATH
    ])
    t.end()
  })

  t.test('should log warning when instrumentation fails and no onError handler', (t) => {
    const origError = new Error('failed to instrument')
    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onRequire: () => {
        throw origError
      }
    })

    require(TEST_MODULE_RELATIVE_PATH)
    t.same(loggerMock.warn.args[0], [
      origError,
      'Custom instrumentation for %s failed. Please report this to the maintainers of the custom instrumentation.',
      TEST_MODULE_PATH
    ])
    t.end()
  })

  t.test(
    'should skip instrumentation if hooks for the same package version have already run',
    (t) => {
      const opts = {
        moduleName: TEST_MODULE_PATH,
        onRequire: () => {}
      }

      shimmer.registerInstrumentation(opts)
      require(TEST_MODULE_RELATIVE_PATH)
      clearCachedModules([TEST_MODULE_RELATIVE_PATH])
      require(TEST_MODULE_RELATIVE_PATH)
      t.same(loggerMock.trace.args[2], [
        'Already instrumented test-mod/module@0.0.1, skipping registering instrumentation'
      ])
      t.end()
    }
  )

  t.test(
    'should skip instrumentation if hooks for the same package version have already errored',
    (t) => {
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
      t.same(loggerMock.trace.args[2], [
        'Failed to instrument test-mod/module@0.0.1, skipping registering instrumentation'
      ])
      t.end()
    }
  )

  t.test('should return package version from package.json', (t) => {
    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onRequire: () => {}
    })

    require(TEST_MODULE_RELATIVE_PATH)
    const version = shimmer.getPackageVersion(TEST_MODULE_PATH)
    t.not(loggerMock.debug.callCount)
    t.equal(version, '0.0.1', 'should get package version from package.json')
    t.end()
  })

  t.test(
    'should return Node.js version when it cannot obtain package version from package.json',
    (t) => {
      const version = shimmer.getPackageVersion('bogus')
      t.equal(version, process.version)
      t.same(loggerMock.debug.args[0], [
        'Failed to get version for `%s`, reason: %s',
        'bogus',
        `no tracked items for module 'bogus'`
      ])
      t.end()
    }
  )
})

function clearCachedModules(modules) {
  modules.forEach((moduleName) => {
    try {
      const requirePath = require.resolve(moduleName)
      delete require.cache[requirePath]
      return true
    } catch (e) {
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
