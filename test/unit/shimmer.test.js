/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
const tap = require('tap')
tap.mochaGlobals()

const path = require('path')

const oldInstrumentations = require('../../lib/instrumentations')
const insPath = require.resolve('../../lib/instrumentations')
require.cache[insPath].exports = wrappedInst
function wrappedInst() {
  const ret = oldInstrumentations()
  ret['../lib/broken_instrumentation_module'] = {
    module: '../test/lib/broken_instrumentation_module'
  }
  return ret
}

const chai = require('chai')
const expect = chai.expect
const helper = require('../lib/agent_helper')
const logger = require('../../lib/logger').child({ component: 'TEST' })
const shimmer = require('../../lib/shimmer')
const shims = require('../../lib/shim')
const EventEmitter = require('events').EventEmitter

const TEST_MODULE_PATH = '../helpers/module'

describe('shimmer', function () {
  describe('custom instrumentation', function () {
    describe('of relative modules', makeModuleTests(TEST_MODULE_PATH))
    describe('of modules', makeModuleTests('chai'))
    describe('of modules, where instrumentation fails', makeModuleTests('chai', true))
    describe('of deep modules', makeModuleTests('chai/lib/chai'))
  })

  function makeModuleTests(moduleName, throwsError) {
    return function moduleTests() {
      let agent = null
      let onRequireArgs = null
      let counter = 0
      let instrumentationOpts = null
      let instrumentedModule = null

      beforeEach(function () {
        agent = helper.instrumentMockedAgent()
        instrumentationOpts = {
          moduleName: moduleName,
          onRequire: function (shim, module) {
            instrumentedModule = module
            ++counter
            onRequireArgs = arguments
            if (throwsError) {
              throw new Error('This threw an error! Oh no!')
            }
          },
          onError: function () {}
        }
        shimmer.registerInstrumentation(instrumentationOpts)
      })

      afterEach(function () {
        counter = 0
        onRequireArgs = null

        clearCachedModules([TEST_MODULE_PATH])

        helper.unloadAgent(agent)
      })

      it('should be sent a shim and the loaded module', function () {
        const mod = require(moduleName)
        expect(onRequireArgs.length).to.equal(3)
        expect(onRequireArgs[0]).to.be.an.instanceof(shims.Shim)
        expect(onRequireArgs[1]).to.equal(mod)
        expect(onRequireArgs[2]).to.equal(moduleName)
      })

      it('should construct a DatastoreShim if the type is "datastore"', function () {
        instrumentationOpts.type = 'datastore'
        require(moduleName)
        expect(onRequireArgs[0]).to.be.an.instanceof(shims.DatastoreShim)
      })

      it('should receive the correct module (' + moduleName + ')', function () {
        const mod = require(moduleName)
        expect(mod).to.equal(instrumentedModule)
      })

      it('should only run the instrumentation once', function () {
        expect(counter).to.equal(0)
        require(moduleName)
        expect(counter).to.equal(1)
        require(moduleName)
        require(moduleName)
        require(moduleName)
        require(moduleName)
        expect(counter).to.equal(1)
      })

      it('should clean up NR added properties', () => {
        const nrKeys = Object.keys(instrumentedModule).filter((key) => key.startsWith('__NR_'))

        const message = `Expected keys to be equal but found: ${nrKeys.join(', ')}`
        expect(nrKeys.length, message).to.equal(0)
      })
    }
  }

  describe('wrapping exports', function () {
    let agent = null
    let original = null
    let wrapper = null

    beforeEach(function () {
      agent = helper.instrumentMockedAgent()
      shimmer.registerInstrumentation({
        moduleName: TEST_MODULE_PATH,
        onRequire: function (shim, nodule) {
          original = nodule
          wrapper = {}

          shim.wrapExport(original, function () {
            return wrapper
          })
        }
      })
    })

    afterEach(function () {
      helper.unloadAgent(agent)
      original = null
      wrapper = null
    })

    it('should replace the return value from require', function () {
      const obj = require(TEST_MODULE_PATH)
      expect(obj).to.equal(wrapper).and.not.equal(original)
    })
  })

  describe('the instrumentation injector', function () {
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

    it('should wrap a method', function () {
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

      expect(nodule.doubler.__NR_unwrap).a('function')

      nodule.doubler(7, function (z) {
        doubled = z
      })

      expect(doubled).equal(16)
      expect(before).equal(true)
      expect(after).equal(true)
    })

    it('should preserve properties on wrapped methods', () => {
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

      expect(nodule.quadrupler.__NR_unwrap).a('function')
      expect(nodule.quadrupler.test).to.be.a('function')

      nodule.quadrupler(7, function (z) {
        quadrupled = z
      })

      expect(quadrupled).equal(30)
      expect(before).equal(true)
      expect(after).equal(true)
    })

    it('should not error out on external instrumentations that fail', function () {
      expect(function () {
        require('../lib/broken_instrumentation_module')
      }).not.throws()
      require.cache[insPath].exports = oldInstrumentations
    })

    describe('with accessor replacement', function () {
      let simple

      beforeEach(function () {
        simple = { target: true }
      })

      it("shouldn't throw if called with no params", function () {
        expect(function () {
          shimmer.wrapDeprecated()
        }).not.throws()
      })

      it("shouldn't throw if called with only the original object", function () {
        expect(function () {
          shimmer.wrapDeprecated(simple)
        }).not.throws()
      })

      it("shouldn't throw if property to be replaced is omitted", function () {
        expect(function () {
          shimmer.wrapDeprecated(simple, 'nodule', null, {
            get: function () {},
            set: function () {}
          })
        }).not.throws()
      })

      it("shouldn't throw if getter is omitted", function () {
        expect(function () {
          shimmer.wrapDeprecated(simple, 'nodule', 'target', { set: function () {} })
        }).not.throws()
      })

      it("shouldn't throw if setter is omitted", function () {
        expect(function () {
          shimmer.wrapDeprecated(simple, 'nodule', 'target', { get: function () {} })
        }).not.throws()
      })

      it('should replace a property with an accessor', function (done) {
        const original = shimmer.wrapDeprecated(simple, 'nodule', 'target', {
          get: function () {
            // test will only complete if this is called
            done()
            return false
          }
        })
        expect(original).equal(true)

        expect(simple.target).equal(false)
      })

      it('should invoke the setter when the accessor is used', function (done) {
        const test = 'ham'
        const original = shimmer.wrapDeprecated(simple, 'nodule', 'target', {
          get: function () {
            return test
          },
          set: function (value) {
            expect(value).equal('eggs')
            done()
          }
        })
        expect(original).equal(true)
        expect(simple.target).equal('ham')
        simple.target = 'eggs'
      })
    })

    it('should wrap, then unwrap a method', function () {
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

      expect(tripled).equal(23)
      expect(before).equal(true)
      expect(after).equal(true)

      before = false
      after = false

      shimmer.unwrapMethod(nodule, 'nodule', 'tripler')

      nodule.tripler(9, function (j) {
        tripled = j
      })

      expect(tripled).equal(29)
      expect(before).equal(false)
      expect(after).equal(false)
    })

    it("shouldn't break anything when an NR-wrapped method is wrapped again", function () {
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

      expect(hamceptacle).equal('hamBurt')
      expect(before).equal(true)
      expect(after).equal(true)
      expect(hammed).equal(true)
    })

    describe('with full instrumentation running', function () {
      let agent

      beforeEach(function () {
        agent = helper.loadMockedAgent()
      })

      afterEach(function () {
        helper.unloadAgent(agent)
      })

      it('should push transactions through process.nextTick', function (done) {
        expect(agent.getTransaction()).equal(null)

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
                expect(lookup).equal(current)

                synchronizer.emit('inner', lookup, i)
              })
            )
          })
          wrapped()
        }

        let doneCount = 0
        synchronizer.on('inner', function (trans, j) {
          doneCount += 1
          expect(trans).equal(transactions[j])
          expect(trans.id).equal(ids[j])

          trans.end()

          if (doneCount === 10) {
            return done()
          }
        })

        for (let i = 0; i < 10; i += 1) {
          process.nextTick(spamTransaction.bind(this, i))
        }
      })

      it('should push transactions through setTimeout', function (done) {
        expect(agent.getTransaction()).equal(null)

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
                expect(lookup).equal(current)

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
          expect(trans).equal(transactions[j])
          expect(trans.id).equal(ids[j])

          trans.end()

          if (doneCount === 10) {
            return done()
          }
        })

        for (let i = 0; i < 10; i += 1) {
          // You know what this test needs? Some non-determinism!
          const timeout = Math.floor(Math.random() * 20)
          setTimeout(spamTransaction.bind(this, i), timeout)
        }
      })

      it('should push transactions through EventEmitters', function (done) {
        expect(agent.getTransaction()).equal(null)

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
                expect(lookup).equal(current)
                expect(lookup.id).equal(id)

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
          expect(trans).equal(transactions[j])
          expect(trans.id).equal(ids[j])

          trans.end()

          if (doneCount === 10) {
            return done()
          }
        })

        for (let i = 0; i < 10; i += 1) {
          eventTransaction(i)
        }
      })

      it('should handle whatever ridiculous nonsense you throw at it', function (done) {
        expect(agent.getTransaction()).equal(null)

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

          expect(lookup).equal(passed)
          expect(lookup).equal(transactions[i])
          expect(lookup.id).equal(ids[i])
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
          expect(trans).equal(transactions[j])
          expect(trans.id).equal(ids[j])

          trans.end()

          if (doneCount === 10) {
            return done()
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

  const loadedModule = require(TEST_MODULE_PATH)

  t.equal(loadedModule.foo, 'bar')

  const nrProps = Object.keys(loadedModule).filter((key) => {
    return key.startsWith('__NR')
  })

  // Future proofing to catch any added symbols. If test  module modified to add own symbol
  // will have to filter out here.
  const nrSymbols = Object.getOwnPropertySymbols(loadedModule)

  t.equal(nrProps.length, 0, `should not have any NR props but found: ${JSON.stringify(nrProps)}`)
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

tap.test('onResolved', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('Should be invoked with resolved module path', (t) => {
    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onResolved: onResolvedHandler
    })

    require(TEST_MODULE_PATH)

    function onResolvedHandler(shim, moduleName, resolvedFilepath) {
      const expectedResolvePath = `${path.join(__dirname, TEST_MODULE_PATH)}.js`

      t.ok(shim)
      t.equal(shim.moduleName, TEST_MODULE_PATH)
      t.equal(moduleName, TEST_MODULE_PATH)
      t.equal(resolvedFilepath, expectedResolvePath)

      t.end()
    }
  })

  t.test('Should invoke prior to onRequire hook', (t) => {
    const invokedHooks = []

    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onResolved: onResolvedHandler,
      onRequire: onRequireHandler
    })

    function onResolvedHandler() {
      invokedHooks.push('onResolvedHandler')
    }

    function onRequireHandler() {
      invokedHooks.push('onRequireHandler')
    }

    require(TEST_MODULE_PATH)

    t.equal(invokedHooks[0], 'onResolvedHandler')
    t.equal(invokedHooks[1], 'onRequireHandler')

    t.end()
  })

  t.test('Should not crash when handler errors without onError', (t) => {
    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onResolved: onResolvedHandler
    })

    function onResolvedHandler() {
      throw new Error('Instrumentation is haunted.')
    }

    const exportedModule = require(TEST_MODULE_PATH)

    t.ok(exportedModule)

    t.end()
  })

  t.test('Should invoke onError on errors', (t) => {
    const expectedError = new Error('Instrumentation is haunted.')

    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onResolved: onResolvedHandler,
      onError: onErrorHandler
    })

    function onResolvedHandler() {
      throw expectedError
    }

    let capturedError = null
    function onErrorHandler(error) {
      capturedError = error
    }

    const exportedModule = require(TEST_MODULE_PATH)

    t.ok(exportedModule)
    t.equal(capturedError, expectedError)

    t.end()
  })

  t.test('Should not crash when onError throws', (t) => {
    shimmer.registerInstrumentation({
      moduleName: TEST_MODULE_PATH,
      onResolved: onResolvedHandler,
      onError: onErrorHandler
    })

    function onResolvedHandler() {
      throw new Error('Instrumentation is haunted.')
    }

    function onErrorHandler() {
      throw new Error('onErrorHandler fails to handle errors')
    }

    const exportedModule = require(TEST_MODULE_PATH)

    t.ok(exportedModule)

    t.end()
  })

  t.test('Should not re-execute successful onResolved on multiple requires', (t) => {
    t.teardown(() => {
      clearCachedModules(['./module', '../helpers/require-module-1', '../helpers/require-module-2'])
    })

    shimmer.registerInstrumentation({
      moduleName: './module', // Register how required modules will require this module
      onResolved: onResolvedHandler
    })

    let invokeCount = 0
    function onResolvedHandler() {
      invokeCount++
    }

    require('../helpers/require-module-1')
    require('../helpers/require-module-2')

    t.equal(invokeCount, 1)

    t.end()
  })

  t.test('Should not retry previously failed instrumentation', (t) => {
    t.teardown(() => {
      clearCachedModules(['./module', '../helpers/require-module-1', '../helpers/require-module-2'])
    })

    shimmer.registerInstrumentation({
      moduleName: './module', // Register how required modules will require this module
      onResolved: onResolvedHandler
    })

    let invokeCount = 0
    function onResolvedHandler() {
      invokeCount++
      throw new Error('Instrumentation is haunted.')
    }

    require('../helpers/require-module-1')
    require('../helpers/require-module-2')

    t.equal(invokeCount, 1)

    t.end()
  })
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
