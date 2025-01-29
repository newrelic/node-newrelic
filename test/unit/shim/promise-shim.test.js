/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const PromiseShim = require('../../../lib/shim/promise-shim')
const Shim = require('../../../lib/shim/shim')

function sameTransaction(tx1, tx2) {
  assert.ok(tx1, 'current transaction exists')
  assert.ok(tx2, 'active transaction exists')
  assert.equal(tx1.id, tx2.id, 'current transaction id should match active transaction id')
}

test('PromiseShim', async (t) => {
  // ensure the test does not exist before all pending
  // runOutOfContext tasks are executed
  helper.outOfContextQueueInterval.ref()

  // unref the runOutOfContext interval
  // so other tests can run unencumbered
  t.after(() => {
    helper.outOfContextQueueInterval.unref()
  })

  function beforeTest(ctx) {
    ctx.nr = {}
    ctx.nr.TestPromise = require('./promise-shim')()

    const agent = helper.loadMockedAgent()
    ctx.nr.shim = new PromiseShim(agent, 'test-promise', null)
    ctx.nr.agent = agent
  }

  function afterTest(ctx) {
    helper.unloadAgent(ctx.nr.agent)
  }

  await t.test('constructor', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await t.test('should inherit from Shim', (t) => {
      const { shim } = t.nr
      assert.ok(shim instanceof PromiseShim)
      assert.ok(shim instanceof Shim)
    })

    await t.test('should require the `agent` parameter', () => {
      assert.throws(
        () => new PromiseShim(),
        'Error: Shim must be initialized with agent and module name'
      )
    })

    await t.test('should require the `moduleName` parameter', (t) => {
      const { agent } = t.nr
      assert.throws(
        () => new PromiseShim(agent),
        'Error: Shim must be initialized with agent and module name'
      )
    })

    await t.test('should assign properties from parent', (t) => {
      const { agent } = t.nr
      const mod = 'test-mod'
      const name = mod
      const version = '1.0.0'
      const shim = new PromiseShim(agent, mod, mod, name, version)
      assert.equal(shim.moduleName, mod)
      assert.equal(agent, shim._agent)
      assert.equal(shim.pkgVersion, version)
    })
  })

  await t.test('.Contextualizer', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await t.test('should be the underlying contextualization class', () => {
      assert.ok(PromiseShim.Contextualizer)
      assert.ok(PromiseShim.Contextualizer instanceof Function)
    })
  })

  await t.test('#logger', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await t.test('should be a non-writable property', (t) => {
      const { shim } = t.nr
      assert.throws(() => (shim.logger = 'foobar'))
      assert.notStrictEqual(shim.logger, 'foobar')
    })

    await t.test('should have expected log levels', (t) => {
      const { shim } = t.nr
      assert.ok(shim.logger.trace)
      assert.ok(shim.logger.trace instanceof Function)
      assert.ok(shim.logger.debug)
      assert.ok(shim.logger.debug instanceof Function)
      assert.ok(shim.logger.info)
      assert.ok(shim.logger.info instanceof Function)
      assert.ok(shim.logger.warn)
      assert.ok(shim.logger.warn instanceof Function)
      assert.ok(shim.logger.error)
      assert.ok(shim.logger.error instanceof Function)
    })
  })

  await t.test('#setClass', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await t.test('should set the class used for instance checks', (t) => {
      const { shim, TestPromise } = t.nr
      const p = new TestPromise(() => {})
      assert.equal(shim.isPromiseInstance(p), false)
      shim.setClass(TestPromise)
      assert.equal(shim.isPromiseInstance(p), true)
    })

    await t.test('should detect if an object is an instance of the instrumented class', (t) => {
      const { shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      assert.ok(!shim.isPromiseInstance(TestPromise))
      assert.equal(shim.isPromiseInstance(new TestPromise(() => {})), true)
      assert.ok(!shim.isPromiseInstance(new Promise(() => {})))
      assert.ok(!shim.isPromiseInstance({}))
    })
  })

  await t.test('#wrapConstructor', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await t.test('should accept just a class constructor', async (t) => {
      const { shim, TestPromise } = t.nr
      const WrappedPromise = shim.wrapConstructor(TestPromise)
      assert.notEqual(WrappedPromise, TestPromise)
      assert.equal(shim.isWrapped(WrappedPromise), true)

      const p = new WrappedPromise((resolve, reject) => {
        assert.equal(typeof resolve, 'function')
        assert.equal(typeof reject, 'function')
        resolve()
      })

      assert.ok(p instanceof WrappedPromise, 'instance of wrapped promise')
      assert.ok(p instanceof TestPromise, 'instance of test promise')
      return p
    })

    await t.test('should accept a nodule and property', async (t) => {
      const { shim, TestPromise } = t.nr
      const testing = { TestPromise }
      shim.wrapConstructor(testing, 'TestPromise')
      assert.ok(testing.TestPromise)
      assert.notEqual(testing.TestPromise, TestPromise)
      assert.equal(shim.isWrapped(testing.TestPromise), true)

      const p = new testing.TestPromise((resolve, reject) => {
        assert.equal(typeof resolve, 'function')
        assert.equal(typeof reject, 'function')
        resolve()
      })

      assert.ok(p instanceof testing.TestPromise)
      assert.ok(p instanceof TestPromise)
      return p
    })

    await t.test('should execute the executor', async (t) => {
      const { agent, shim, TestPromise } = t.nr
      return helper.runInTransaction(agent, () => {
        let executed = false

        const WrappedPromise = shim.wrapConstructor(TestPromise)
        const p = new WrappedPromise((resolve) => {
          executed = true
          resolve()
        })

        assert.equal(executed, true)

        return p
      })
    })

    await t.test('should not change resolve values', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      helper.runInTransaction(agent, () => {
        const resolution = {}

        const WrappedPromise = shim.wrapConstructor(TestPromise)
        const p = new WrappedPromise((resolve) => {
          resolve(resolution)
        })

        p.then((val) => {
          assert.equal(val, resolution)
          end()
        })
      })
    })

    await t.test('should not change reject values', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      helper.runInTransaction(agent, () => {
        const rejection = {}

        const WrappedPromise = shim.wrapConstructor(TestPromise)
        const p = new WrappedPromise((resolve, reject) => {
          reject(rejection)
        })

        p.catch((val) => {
          assert.equal(val, rejection)
          end()
        })
      })
    })

    await t.test('should capture errors thrown in the executor', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      helper.runInTransaction(agent, () => {
        const WrappedPromise = shim.wrapConstructor(TestPromise)

        let p = null
        assert.doesNotThrow(() => {
          p = new WrappedPromise(() => {
            throw new Error('this should be caught')
          })
        })

        p.catch((err) => {
          assert.ok(err instanceof Error)
          assert.ok(err.message)
          end()
        })
      })
    })

    await t.test('should reinstate lost context', async (t) => {
      const { agent, shim, TestPromise } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        shim.setClass(TestPromise)
        const WrappedPromise = shim.wrapConstructor(TestPromise)

        // Wrapping then is required to make sure the then callback is wrapped
        // with context propagation.
        shim.wrapThen(TestPromise.prototype, 'then')

        const txTest = async (runOutOfContext, runNext) => {
          sameTransaction(agent.getTransaction(), tx)
          return new WrappedPromise((resolve) => {
            sameTransaction(agent.getTransaction(), tx)
            if (runOutOfContext) {
              helper.runOutOfContext(resolve) // <-- Context loss before resolve.
            } else {
              return resolve() // <-- Resolve will lose context.
            }
          })
            .then(() => {
              sameTransaction(agent.getTransaction(), tx)
              if (runNext) {
                return runNext() // < a cheap way of chaining these without async
              }
            })
            .catch((err) => {
              assert.ok(!err, 'Promise context restore should not error.')
            })
        }

        txTest(false, () => txTest(true))
      })
    })
  })

  await t.test('#wrapExecutorCaller', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await t.test('should accept just a function', (t) => {
      const { shim, TestPromise } = t.nr
      const wrappedCaller = shim.wrapExecutorCaller(TestPromise.prototype.executorCaller)
      assert.notEqual(wrappedCaller, TestPromise.prototype.executorCaller)
      assert.equal(shim.isWrapped(wrappedCaller), true)

      TestPromise.prototype.executorCaller = wrappedCaller

      const p = new TestPromise((resolve, reject) => {
        assert.equal(typeof resolve, 'function')
        assert.equal(typeof reject, 'function')
        resolve()
      })

      assert.ok(p instanceof TestPromise)
      return p
    })

    await t.test('should accept a nodule and property', (t) => {
      const { shim, TestPromise } = t.nr
      shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
      assert.equal(shim.isWrapped(TestPromise.prototype.executorCaller), true)

      const p = new TestPromise((resolve, reject) => {
        assert.equal(typeof resolve, 'function')
        assert.equal(typeof reject, 'function')
        resolve()
      })
      assert.ok(p instanceof TestPromise)
      return p
    })

    await t.test('should execute the executor', (t) => {
      const { agent, shim, TestPromise } = t.nr
      return helper.runInTransaction(agent, () => {
        let executed = false

        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
        const p = new TestPromise((resolve) => {
          executed = true
          resolve()
        })

        assert.equal(executed, true)
        return p
      })
    })

    await t.test('should not change resolve values', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      helper.runInTransaction(agent, () => {
        const resolution = {}

        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
        const p = new TestPromise((resolve) => {
          resolve(resolution)
        })

        p.then((val) => {
          assert.equal(val, resolution)
          end()
        })
      })
    })

    await t.test('should not change reject values', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      helper.runInTransaction(agent, () => {
        const rejection = {}

        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
        const p = new TestPromise((resolve, reject) => {
          reject(rejection)
        })

        p.catch((val) => {
          assert.equal(val, rejection)
          end()
        })
      })
    })

    await t.test('should capture errors thrown in the executor', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      helper.runInTransaction(agent, () => {
        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')

        let p = null
        assert.doesNotThrow(() => {
          p = new TestPromise(() => {
            throw new Error('this should be caught')
          })
        })

        p.catch((err) => {
          assert.ok(err instanceof Error)
          assert.ok(err.message)
          end()
        })
      })
    })

    await t.test('should reinstate lost context', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      helper.runInTransaction(agent, async (tx) => {
        shim.setClass(TestPromise)
        shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')

        // Wrapping then is required to make sure the then callback is wrapped
        // with context propagation.
        shim.wrapThen(TestPromise.prototype, 'then')

        const txTest = async (runOutOfContext, runNext) => {
          sameTransaction(agent.getTransaction(), tx)
          return new TestPromise((resolve) => {
            sameTransaction(agent.getTransaction(), tx)
            if (runOutOfContext) {
              return helper.runOutOfContext(resolve) // <-- Context loss before resolve.
            }
            return resolve() // <-- Resolve will lose context.
          })
            .then(() => {
              sameTransaction(agent.getTransaction(), tx)
              if (runNext) {
                return runNext()
              }
              end()
            })
            .catch((err) => {
              assert.ok(!err, 'Promise context restore should not error.')
            })
        }
        txTest(false, () => txTest(true))
      })
    })
  })

  await t.test('#wrapCast', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await t.test('should accept just a function', (t, end) => {
      const { shim, TestPromise } = t.nr
      const wrappedResolve = shim.wrapCast(TestPromise.resolve)
      assert.ok(typeof wrappedResolve, 'function')
      assert.notEqual(wrappedResolve, TestPromise.resolve)
      assert.equal(shim.isWrapped(wrappedResolve), true)

      const p = wrappedResolve('foo')
      assert.ok(p instanceof TestPromise)
      p.then((val) => {
        assert.equal(val, 'foo')
        end()
      })
    })

    await t.test('should accept a nodule and property', (t, end) => {
      const { shim, TestPromise } = t.nr
      shim.wrapCast(TestPromise, 'resolve')
      assert.equal(typeof TestPromise.resolve, 'function')
      assert.equal(shim.isWrapped(TestPromise.resolve), true)

      const p = TestPromise.resolve('foo')
      assert.ok(p instanceof TestPromise)
      p.then((val) => {
        assert.equal(val, 'foo')
        end()
      })
    })

    await t.test('should link context through to thenned callbacks', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapCast(TestPromise, 'resolve')
      shim.wrapThen(TestPromise.prototype, 'then')

      helper.runInTransaction(agent, (tx) => {
        TestPromise.resolve().then(() => {
          sameTransaction(agent.getTransaction(), tx)
          end()
        })
      })
    })

    await t.test('should not link context through to thenned callbacks when transaction ends before Promise calls', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapCast(TestPromise, 'resolve')
      shim.wrapThen(TestPromise.prototype, 'then')

      helper.runInTransaction(agent, (tx) => {
        tx.end()
        TestPromise.resolve().then(() => {
          assert.equal(agent.getTransaction(), null)
          assert.equal(shim.getActiveSegment(), null)
          end()
        })
      })
    })
  })

  await t.test('#wrapThen', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await t.test('should accept just a function', (t, end) => {
      const { shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      const wrappedThen = shim.wrapThen(TestPromise.prototype.then)
      assert.equal(typeof wrappedThen, 'function')
      assert.notEqual(wrappedThen, TestPromise.prototype.then)
      assert.equal(shim.isWrapped(wrappedThen), true)

      const p = TestPromise.resolve('foo')
      assert.ok(p instanceof TestPromise)
      wrappedThen.call(p, (val) => {
        assert.equal(val, 'foo')
        end()
      })
    })

    await t.test('should accept a nodule and property', (t, end) => {
      const { shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapThen(TestPromise.prototype, 'then')
      assert.equal(typeof TestPromise.prototype.then, 'function')
      assert.equal(shim.isWrapped(TestPromise.prototype.then), true)

      const p = TestPromise.resolve('foo')
      assert.ok(p instanceof TestPromise)
      p.then((val) => {
        assert.equal(val, 'foo')
        end()
      })
    })

    await t.test('should link context through to thenned callbacks', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapThen(TestPromise.prototype, 'then')

      helper.runInTransaction(agent, (tx) => {
        TestPromise.resolve().then(() => {
          sameTransaction(agent.getTransaction(), tx)
          end()
        })
      })
    })

    await t.test('should not link context through to thenned callbacks when transaction ends before Promise calls', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapThen(TestPromise.prototype, 'then')

      helper.runInTransaction(agent, (tx) => {
        tx.end()
        TestPromise.resolve().then(() => {
          assert.equal(agent.getTransaction(), null)
          assert.equal(shim.getActiveSegment(), null)
          end()
        })
      })
    })

    await t.test('should wrap both handlers', (t) => {
      const { shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapThen(TestPromise.prototype, 'then')
      function resolve() {}
      function reject() {}

      const p = TestPromise.resolve()
      p.then(resolve, reject)

      assert.equal(typeof p.res, 'function')
      assert.notEqual(p.res, resolve)
      assert.equal(typeof p.rej, 'function')
      assert.notEqual(p.rej, reject)
    })
  })

  await t.test('#wrapCatch', async (t) => {
    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    await t.test('should accept just a function', (t, end) => {
      const { shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      const wrappedCatch = shim.wrapCatch(TestPromise.prototype.catch)
      assert.equal(typeof wrappedCatch, 'function')
      assert.notEqual(wrappedCatch, TestPromise.prototype.catch)
      assert.equal(shim.isWrapped(wrappedCatch), true)

      const p = TestPromise.reject('foo')
      assert.ok(p instanceof TestPromise)
      wrappedCatch.call(p, (val) => {
        assert.equal(val, 'foo')
        end()
      })
    })

    await t.test('should accept a nodule and property', (t, end) => {
      const { shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapCatch(TestPromise.prototype, 'catch')
      assert.equal(typeof TestPromise.prototype.catch, 'function')
      assert.equal(shim.isWrapped(TestPromise.prototype.catch), true)

      const p = TestPromise.reject('foo')
      assert.ok(p instanceof TestPromise)
      p.catch((val) => {
        assert.equal(val, 'foo')
        end()
      })
    })

    await t.test('should link context through to thenned callbacks', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapCatch(TestPromise.prototype, 'catch')

      helper.runInTransaction(agent, (tx) => {
        TestPromise.reject().catch(() => {
          sameTransaction(agent.getTransaction(), tx)
          end()
        })
      })
    })

    await t.test('should not link context through to thenned callbacks when transaction ends before promise calls', (t, end) => {
      const { agent, shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapCatch(TestPromise.prototype, 'catch')

      helper.runInTransaction(agent, (tx) => {
        tx.end()
        TestPromise.reject().catch(() => {
          assert.equal(agent.getTransaction(), null)
          assert.equal(shim.getActiveSegment(), null)
          end()
        })
      })
    })

    await t.test('should only wrap the rejection handler', (t) => {
      const { shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapCatch(TestPromise.prototype, 'catch')

      const p = TestPromise.reject()
      function reject() {}
      p.catch(Error, reject)

      assert.ok(p.ErrorClass)
      assert.equal(typeof p.rej, 'function')
      assert.notEqual(p.rej, reject)
    })
  })

  await t.test('#wrapPromisify', async (t) => {
    t.beforeEach((ctx) => {
      beforeTest(ctx)
      ctx.nr.asyncFn = (val, cb) => {
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

    await t.test('should accept just a function', (t) => {
      const { asyncFn, shim, TestPromise } = t.nr
      const wrappedPromisify = shim.wrapPromisify(TestPromise.promisify)
      assert.equal(typeof wrappedPromisify, 'function')
      assert.notEqual(wrappedPromisify, TestPromise.promisify)
      assert.equal(shim.isWrapped(wrappedPromisify), true)

      const promised = wrappedPromisify(shim, asyncFn)
      assert.equal(typeof promised, 'function')
      assert.notEqual(promised, asyncFn)
    })

    await t.test('should accept a nodule and property', (t) => {
      const { asyncFn, shim, TestPromise } = t.nr
      shim.wrapPromisify(TestPromise, 'promisify')
      assert.equal(typeof TestPromise.promisify, 'function')
      assert.equal(shim.isWrapped(TestPromise.promisify), true)

      const promised = TestPromise.promisify(shim, asyncFn)
      assert.equal(typeof promised, 'function')
      assert.notEqual(promised, asyncFn)
    })

    await t.test('should propagate transaction context', (t, end) => {
      const { agent, asyncFn, shim, TestPromise } = t.nr
      shim.setClass(TestPromise)
      shim.wrapPromisify(TestPromise, 'promisify')
      shim.wrapThen(TestPromise.prototype, 'then')

      const promised = TestPromise.promisify(shim, asyncFn)

      helper.runInTransaction(agent, (tx) => {
        promised('foobar').then((val) => {
          sameTransaction(agent.getTransaction(), tx)
          assert.equal(val, 'foobar')
          end()
        })
      })
    })
  })
})
