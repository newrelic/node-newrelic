/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')

const asyncLib = require('async')
const helper = require('../../lib/agent_helper')
const PromiseShim = require('../../../lib/shim/promise-shim')
const Shim = require('../../../lib/shim/shim')

tap.Test.prototype.addAssert('sameTransaction', 2, function expectSameTransaction(tx1, tx2) {
  this.ok(tx1, 'current transaction exists')
  this.ok(tx2, 'active transaction exists')
  this.equal(tx1.id, tx2.id, 'current transaction id should match active transaction id')
})

tap.test('PromiseShim', (t) => {
  t.autoend()

  // ensure the test does not exist before all pending
  // runOutOfContext tasks are executed
  helper.outOfContextQueueInterval.ref()

  // unref the runOutOfContext interval
  // so other tests can run unencumbered
  t.teardown(() => {
    helper.outOfContextQueueInterval.unref()
  })

  let agent = null
  let shim = null
  let TestPromise = null

  function beforeTest() {
    TestPromise = require('./promise-shim')()

    agent = helper.loadMockedAgent()
    shim = new PromiseShim(agent, 'test-promise', null)
  }

  function afterTest() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
    TestPromise = null
  }

  t.test('constructor', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should inherit from Shim', (t) => {
      t.ok(shim instanceof PromiseShim)
      t.ok(shim instanceof Shim)
      t.end()
    })

    t.test('should require the `agent` parameter', (t) => {
      t.throws(() => new PromiseShim(), /^Shim must be initialized with .*? agent/)
      t.end()
    })

    t.test('should require the `moduleName` parameter', (t) => {
      t.throws(() => new PromiseShim(agent), /^Shim must be initialized with .*? module name/)
      t.end()
    })
  })

  t.test('.Contextualizer', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should be the underlying contextualization class', (t) => {
      t.ok(PromiseShim.Contextualizer)
      t.ok(PromiseShim.Contextualizer instanceof Function)
      t.end()
    })
  })

  t.test('#logger', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should be a non-writable property', (t) => {
      t.throws(() => (shim.logger = 'foobar'))
      t.not(shim.logger, 'foobar')
      t.end()
    })

    t.test('should have expected log levels', (t) => {
      t.ok(shim.logger.trace)
      t.ok(shim.logger.trace instanceof Function)
      t.ok(shim.logger.debug)
      t.ok(shim.logger.debug instanceof Function)
      t.ok(shim.logger.info)
      t.ok(shim.logger.info instanceof Function)
      t.ok(shim.logger.warn)
      t.ok(shim.logger.warn instanceof Function)
      t.ok(shim.logger.error)
      t.ok(shim.logger.error instanceof Function)
      t.end()
    })
  })

  t.test('#setClass', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should set the class used for instance checks', (t) => {
      const p = new TestPromise(() => {})
      t.notOk(shim.isPromiseInstance(p))
      shim.setClass(TestPromise)
      t.ok(shim.isPromiseInstance(p))
      t.end()
    })

    t.test('should detect if an object is an instance of the instrumented class', (t) => {
      shim.setClass(TestPromise)
      t.notOk(shim.isPromiseInstance(TestPromise))
      t.ok(shim.isPromiseInstance(new TestPromise(() => {})))
      t.notOk(shim.isPromiseInstance(new Promise(() => {})))
      t.notOk(shim.isPromiseInstance({}))
      t.end()
    })
  })

  t.test('#wrapConstructor', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should accept just a class constructor', (t) => {
      const WrappedPromise = shim.wrapConstructor(TestPromise)
      t.not(WrappedPromise, TestPromise)
      t.ok(shim.isWrapped(WrappedPromise))

      const p = new WrappedPromise((resolve, reject) => {
        t.equal(typeof resolve, 'function')
        t.equal(typeof reject, 'function')
        resolve()
      })

      t.ok(p instanceof WrappedPromise, 'instance of wrapped promise')
      t.ok(p instanceof TestPromise, 'instance of test promise')
      return p
    })

    t.test('should accept a nodule and property', (t) => {
      const testing = { TestPromise }
      shim.wrapConstructor(testing, 'TestPromise')
      t.ok(testing.TestPromise)
      t.not(testing.TestPromise, TestPromise)
      t.ok(shim.isWrapped(testing.TestPromise))

      const p = new testing.TestPromise((resolve, reject) => {
        t.equal(typeof resolve, 'function')
        t.equal(typeof reject, 'function')
        resolve()
      })

      t.ok(p instanceof testing.TestPromise)
      t.ok(p instanceof TestPromise)
      return p
    })

    t.test('should execute the executor', (t) => {
      return helper.runInTransaction(agent, () => {
        let executed = false

        const WrappedPromise = shim.wrapConstructor(TestPromise)
        const p = new WrappedPromise((resolve) => {
          executed = true
          resolve()
        })

        t.ok(executed)

        return p
      })
    })

    t.test('should not change resolve values', (t) => {
      helper.runInTransaction(agent, () => {
        const resolution = {}

        const WrappedPromise = shim.wrapConstructor(TestPromise)
        const p = new WrappedPromise((resolve) => {
          resolve(resolution)
        })

        p.then((val) => {
          t.equal(val, resolution)
          t.end()
        })
      })
    })

    t.test('should not change reject values', (t) => {
      helper.runInTransaction(agent, () => {
        const rejection = {}

        const WrappedPromise = shim.wrapConstructor(TestPromise)
        const p = new WrappedPromise((resolve, reject) => {
          reject(rejection)
        })

        p.catch((val) => {
          t.equal(val, rejection)
          t.end()
        })
      })
    })

    t.test('should capture errors thrown in the executor', (t) => {
      helper.runInTransaction(agent, () => {
        const WrappedPromise = shim.wrapConstructor(TestPromise)

        let p = null
        t.doesNotThrow(() => {
          p = new WrappedPromise(() => {
            throw new Error('this should be caught')
          })
        })

        p.catch((err) => {
          t.ok(err instanceof Error)
          t.ok(err.message)
          t.end()
        })
      })
    })

    t.test('should reinstate lost context', (t) => {
      helper.runInTransaction(agent, (tx) => {
        shim.setClass(TestPromise)
        const WrappedPromise = shim.wrapConstructor(TestPromise)

        // Wrapping then is required to make sure the then callback is wrapped
        // with context propagation.
        shim.wrapThen(TestPromise.prototype, 'then')

        asyncLib.series(
          [
            (cb) => {
              t.sameTransaction(agent.getTransaction(), tx)
              new WrappedPromise((resolve) => {
                t.sameTransaction(agent.getTransaction(), tx)
                resolve() // <-- Resolve will lose context.
              })
                .then(() => {
                  t.sameTransaction(agent.getTransaction(), tx)
                  cb()
                })
                .catch(cb)
            },
            (cb) => {
              t.sameTransaction(agent.getTransaction(), tx)
              new WrappedPromise((resolve) => {
                t.sameTransaction(agent.getTransaction(), tx)
                helper.runOutOfContext(resolve) // <-- Context loss before resolve.
              })
                .then(() => {
                  t.sameTransaction(agent.getTransaction(), tx)
                  cb()
                })
                .catch(cb)
            }
          ],
          t.end
        )
      })
    })
  })

  t.test('#wrapExecutorCaller', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should accept just a function', (t) => {
      const wrappedCaller = shim.wrapExecutorCaller(TestPromise.prototype.executorCaller)
      t.not(wrappedCaller, TestPromise.prototype.executorCaller)
      t.ok(shim.isWrapped(wrappedCaller))

      TestPromise.prototype.executorCaller = wrappedCaller

      const p = new TestPromise((resolve, reject) => {
        t.equal(typeof resolve, 'function')
        t.equal(typeof reject, 'function')
        resolve()
      })

      t.ok(p instanceof TestPromise)
      return p
    })

    t.test('should accept a nodule and property', (t) => {
      shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
      t.ok(shim.isWrapped(TestPromise.prototype.executorCaller))

      const p = new TestPromise((resolve, reject) => {
        t.equal(typeof resolve, 'function')
        t.equal(typeof reject, 'function')
        resolve()
      })
      t.ok(p instanceof TestPromise)
      return p
    })

    t.test('should execute the executor', (t) => {
      return helper.runInTransaction(agent, () => {
        let executed = false

        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
        const p = new TestPromise((resolve) => {
          executed = true
          resolve()
        })

        t.ok(executed)
        return p
      })
    })

    t.test('should not change resolve values', (t) => {
      helper.runInTransaction(agent, () => {
        const resolution = {}

        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
        const p = new TestPromise((resolve) => {
          resolve(resolution)
        })

        p.then((val) => {
          t.equal(val, resolution)
          t.end()
        })
      })
    })

    t.test('should not change reject values', (t) => {
      helper.runInTransaction(agent, () => {
        const rejection = {}

        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
        const p = new TestPromise((resolve, reject) => {
          reject(rejection)
        })

        p.catch((val) => {
          t.equal(val, rejection)
          t.end()
        })
      })
    })

    t.test('should capture errors thrown in the executor', (t) => {
      helper.runInTransaction(agent, () => {
        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')

        let p = null
        t.doesNotThrow(() => {
          p = new TestPromise(() => {
            throw new Error('this should be caught')
          })
        })

        p.catch((err) => {
          t.ok(err instanceof Error)
          t.ok(err.message)
          t.end()
        })
      })
    })

    t.test('should reinstate lost context', (t) => {
      helper.runInTransaction(agent, (tx) => {
        shim.setClass(TestPromise)
        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')

        // Wrapping then is required to make sure the then callback is wrapped
        // with context propagation.
        shim.wrapThen(TestPromise.prototype, 'then')

        asyncLib.series(
          [
            (cb) => {
              t.sameTransaction(agent.getTransaction(), tx)
              new TestPromise((resolve) => {
                t.sameTransaction(agent.getTransaction(), tx)
                resolve() // <-- Resolve will lose context.
              })
                .then(() => {
                  t.sameTransaction(agent.getTransaction(), tx)
                  cb()
                })
                .catch(cb)
            },
            (cb) => {
              t.sameTransaction(agent.getTransaction(), tx)
              new TestPromise((resolve) => {
                t.sameTransaction(agent.getTransaction(), tx)
                helper.runOutOfContext(resolve) // <-- Context loss before resolve.
              })
                .then(() => {
                  t.sameTransaction(agent.getTransaction(), tx)
                  cb()
                })
                .catch(cb)
            }
          ],
          t.end
        )
      })
    })
  })

  t.test('#wrapCast', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should accept just a function', (t) => {
      const wrappedResolve = shim.wrapCast(TestPromise.resolve)
      t.equal(typeof wrappedResolve, 'function')
      t.not(wrappedResolve, TestPromise.resolve)
      t.ok(shim.isWrapped(wrappedResolve))

      const p = wrappedResolve('foo')
      t.ok(p instanceof TestPromise)
      p.then((val) => {
        t.equal(val, 'foo')
        t.end()
      })
    })

    t.test('should accept a nodule and property', (t) => {
      shim.wrapCast(TestPromise, 'resolve')
      t.equal(typeof TestPromise.resolve, 'function')
      t.ok(shim.isWrapped(TestPromise.resolve))

      const p = TestPromise.resolve('foo')
      t.ok(p instanceof TestPromise)
      p.then((val) => {
        t.equal(val, 'foo')
        t.end()
      })
    })

    t.test('should link context through to thenned callbacks', (t) => {
      shim.setClass(TestPromise)
      shim.wrapCast(TestPromise, 'resolve')
      shim.wrapThen(TestPromise.prototype, 'then')

      helper.runInTransaction(agent, (tx) => {
        TestPromise.resolve().then(() => {
          t.sameTransaction(agent.getTransaction(), tx)
          t.end()
        })
      })
    })
  })

  t.test('#wrapThen', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should accept just a function', (t) => {
      shim.setClass(TestPromise)
      const wrappedThen = shim.wrapThen(TestPromise.prototype.then)
      t.equal(typeof wrappedThen, 'function')
      t.not(wrappedThen, TestPromise.prototype.then)
      t.ok(shim.isWrapped(wrappedThen))

      const p = TestPromise.resolve('foo')
      t.ok(p instanceof TestPromise)
      wrappedThen.call(p, (val) => {
        t.equal(val, 'foo')
        t.end()
      })
    })

    t.test('should accept a nodule and property', (t) => {
      shim.setClass(TestPromise)
      shim.wrapThen(TestPromise.prototype, 'then')
      t.equal(typeof TestPromise.prototype.then, 'function')
      t.ok(shim.isWrapped(TestPromise.prototype.then))

      const p = TestPromise.resolve('foo')
      t.ok(p instanceof TestPromise)
      p.then((val) => {
        t.equal(val, 'foo')
        t.end()
      })
    })

    t.test('should link context through to thenned callbacks', (t) => {
      shim.setClass(TestPromise)
      shim.wrapThen(TestPromise.prototype, 'then')

      helper.runInTransaction(agent, (tx) => {
        TestPromise.resolve().then(() => {
          t.sameTransaction(agent.getTransaction(), tx)
          t.end()
        })
      })
    })

    t.test('should wrap both handlers', (t) => {
      shim.setClass(TestPromise)
      shim.wrapThen(TestPromise.prototype, 'then')
      function resolve() {}
      function reject() {}

      const p = TestPromise.resolve()
      p.then(resolve, reject)

      t.equal(typeof p.res, 'function')
      t.not(p.res, resolve)
      t.equal(typeof p.rej, 'function')
      t.not(p.rej, reject)
      t.end()
    })
  })

  t.test('#wrapCatch', (t) => {
    t.autoend()
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should accept just a function', (t) => {
      shim.setClass(TestPromise)
      const wrappedCatch = shim.wrapCatch(TestPromise.prototype.catch)
      t.equal(typeof wrappedCatch, 'function')
      t.not(wrappedCatch, TestPromise.prototype.catch)
      t.ok(shim.isWrapped(wrappedCatch))

      const p = TestPromise.reject('foo')
      t.ok(p instanceof TestPromise)
      wrappedCatch.call(p, (val) => {
        t.equal(val, 'foo')
        t.end()
      })
    })

    t.test('should accept a nodule and property', (t) => {
      shim.setClass(TestPromise)
      shim.wrapCatch(TestPromise.prototype, 'catch')
      t.equal(typeof TestPromise.prototype.catch, 'function')
      t.ok(shim.isWrapped(TestPromise.prototype.catch))

      const p = TestPromise.reject('foo')
      t.ok(p instanceof TestPromise)
      p.catch((val) => {
        t.equal(val, 'foo')
        t.end()
      })
    })

    t.test('should link context through to thenned callbacks', (t) => {
      shim.setClass(TestPromise)
      shim.wrapCatch(TestPromise.prototype, 'catch')

      helper.runInTransaction(agent, (tx) => {
        TestPromise.reject().catch(() => {
          t.sameTransaction(agent.getTransaction(), tx)
          t.end()
        })
      })
    })

    t.test('should only wrap the rejection handler', (t) => {
      shim.setClass(TestPromise)
      shim.wrapCatch(TestPromise.prototype, 'catch')

      const p = TestPromise.reject()
      function reject() {}
      p.catch(Error, reject)

      t.ok(p.ErrorClass)
      t.equal(typeof p.rej, 'function')
      t.not(p.rej, reject)
      t.end()
    })
  })

  t.test('#wrapPromisify', (t) => {
    t.autoend()
    let asyncFn = null
    t.beforeEach(() => {
      beforeTest()
      asyncFn = (val, cb) => {
        helper.runOutOfContext(() => {
          if (val instanceof Error) {
            cb(val)
          } else {
            cb(null, val)
          }
        })
      }
    })

    t.afterEach(afterTest)

    t.test('should accept just a function', (t) => {
      const wrappedPromisify = shim.wrapPromisify(TestPromise.promisify)
      t.equal(typeof wrappedPromisify, 'function')
      t.not(wrappedPromisify, TestPromise.promisify)
      t.ok(shim.isWrapped(wrappedPromisify))

      const promised = wrappedPromisify(shim, asyncFn)
      t.equal(typeof promised, 'function')
      t.not(promised, asyncFn)
      t.end()
    })

    t.test('should accept a nodule and property', (t) => {
      shim.wrapPromisify(TestPromise, 'promisify')
      t.equal(typeof TestPromise.promisify, 'function')
      t.ok(shim.isWrapped(TestPromise.promisify))

      const promised = TestPromise.promisify(shim, asyncFn)
      t.equal(typeof promised, 'function')
      t.not(promised, asyncFn)
      t.end()
    })

    t.test('should propagate transaction context', (t) => {
      shim.setClass(TestPromise)
      shim.wrapPromisify(TestPromise, 'promisify')
      shim.wrapThen(TestPromise.prototype, 'then')

      const promised = TestPromise.promisify(shim, asyncFn)

      helper.runInTransaction(agent, (tx) => {
        promised('foobar').then((val) => {
          t.sameTransaction(agent.getTransaction(), tx)
          t.equal(val, 'foobar')
          t.end()
        })
      })
    })
  })
})
