/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { tspl } = require('@matteo.collina/tspl')
const {
  addTask,
  afterEach,
  beforeEach,
  id,
  testPromiseClassMethod,
  testPromiseInstanceMethod
} = require('./helpers')

async function testPromiseContext({ t, factory }) {
  await t.test('context switch', async function (t) {
    const { agent, Promise } = t.nr
    factory = factory.bind(null, Promise)
    const plan = tspl(t, { plan: 2 })

    const ctxA = helper.runInTransaction(agent, function (tx) {
      return {
        transaction: tx,
        promise: factory('[tx a] ')
      }
    })

    helper.runInTransaction(agent, function (txB) {
      t.after(function () {
        ctxA.transaction.end()
        txB.end()
      })
      plan.notEqual(id(ctxA.transaction), id(txB), 'should not be in transaction a')

      ctxA.promise
        .catch(function () {})
        .then(function () {
          const tx = agent.tracer.getTransaction()
          plan.equal(id(tx), id(ctxA.transaction), 'should be in expected context')
        })
    })
    await plan.completed
  })

  // Create in tx a, continue outside of tx
  await t.test('context loss', async function (t) {
    const plan = tspl(t, { plan: 2 })
    const { agent, Promise } = t.nr
    factory = factory.bind(null, Promise)

    const ctxA = helper.runInTransaction(agent, function (tx) {
      t.after(function () {
        tx.end()
      })

      return {
        transaction: tx,
        promise: factory('[tx a] ')
      }
    })

    plan.ok(!agent.tracer.getTransaction(), 'should not be in transaction')
    ctxA.promise
      .catch(function () {})
      .then(function () {
        const tx = agent.tracer.getTransaction()
        plan.equal(id(tx), id(ctxA.transaction), 'should be in expected context')
      })
    await plan.completed
  })

  // Create outside tx, continue in tx a
  await t.test('context gain', async function (t) {
    const plan = tspl(t, { plan: 2 })
    const { agent, Promise } = t.nr
    factory = factory.bind(null, Promise)

    const promise = factory('[no tx] ')

    plan.ok(!agent.tracer.getTransaction(), 'should not be in transaction')
    helper.runInTransaction(agent, function (tx) {
      promise
        .catch(function () {})
        .then(function () {
          const tx2 = agent.tracer.getTransaction()
          plan.equal(id(tx2), id(tx), 'should be in expected context')
        })
    })
    await plan.completed
  })

  // Create test in tx a, end tx a, continue in tx b
  await t.test('context expiration', async function (t) {
    const plan = tspl(t, { plan: 2 })
    const { agent, Promise } = t.nr
    factory = factory.bind(null, Promise)

    const ctxA = helper.runInTransaction(agent, function (tx) {
      return {
        transaction: tx,
        promise: factory('[tx a] ')
      }
    })

    ctxA.transaction.end()
    helper.runInTransaction(agent, function (txB) {
      t.after(function () {
        ctxA.transaction.end()
        txB.end()
      })
      plan.notEqual(id(ctxA.transaction), id(txB), 'should not be in transaction a')

      ctxA.promise
        .catch(function () {})
        .then(function () {
          const tx = agent.tracer.getTransaction()
          plan.equal(id(tx), id(txB), 'should be in expected context')
        })
    })
    await plan.completed
  })
}

function testTryBehavior(method) {
  test('Promise.' + method, async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await testPromiseContext({
      t,
      factory: function (Promise, name) {
        return Promise[method](function () {
          return name
        })
      }
    })

    await t.test('usage', function (t, end) {
      const { Promise } = t.nr
      testPromiseClassMethod({
        t,
        end,
        count: 3,
        testFunc: function tryTest({ plan, name }) {
          return Promise[method](function () {
            throw new Error('Promise.' + method + ' test error')
          })
            .then(
              function () {
                plan.ok(0, name + 'should not go into resolve after throwing')
              },
              function (err) {
                plan.ok(err, name + 'should have error')
                plan.equal(
                  err.message,
                  'Promise.' + method + ' test error',
                  name + 'should be correct error'
                )
              }
            )
            .then(function () {
              const foo = { what: 'Promise.' + method + ' test object' }
              return Promise[method](function () {
                return foo
              }).then(function (obj) {
                plan.equal(obj, foo, name + 'should also work on success')
              })
            })
        }
      })
    })
  })
}

async function testThrowBehavior(methodName) {
  test('Promise#' + methodName, async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await testPromiseContext({
      t,
      factory: function (Promise, name) {
        return Promise.resolve()[methodName](new Error(name))
      }
    })

    await t.test('usage', function (t, end) {
      testPromiseInstanceMethod({
        t,
        end,
        count: 1,
        testFunc: function throwTest({ plan, name, promise }) {
          const foo = { what: 'throw test object' }
          return promise[methodName](foo)
            .then(function () {
              plan.ok(0, name + 'should not go into resolve handler after throw')
            })
            .catch(function (err) {
              plan.equal(err, foo, name + 'should pass throught the correct object')
            })
        }
      })
    })

    await testPromiseInstanceCastMethod({
      t,
      count: 1,
      testFunc: function ({ plan, promise, value }) {
        return promise.thenThrow(value).catch(function (err) {
          plan.equal(err, value, 'should have expected error')
        })
      }
    })
  })
}

function testPromiseClassCastMethod({ t, count, testFunc }) {
  return testAllCastTypes({ t, count, factory: testFunc })
}

function testPromiseInstanceCastMethod({ t, count, testFunc }) {
  return testAllCastTypes({
    t,
    count,
    factory: function ({ Promise, name, value, plan }) {
      return testFunc({ Promise, promise: Promise.resolve(name), name, value, plan })
    }
  })
}

async function testAllCastTypes({ t, count, factory }) {
  const values = [42, 'foobar', {}, [], function () {}]

  await t.test('in context', function (t, end) {
    const { agent } = t.nr
    const plan = tspl(t, { plan: count * values.length + 1 })

    helper.runInTransaction(agent, function (tx) {
      _test({ plan, t, name: '[no-tx]', i: 0 })
        .then(function () {
          const txB = agent.tracer.getTransaction()
          plan.equal(id(tx), id(txB), 'should maintain transaction state')
        })
        .then(end)
    })
  })

  await t.test('out of context', function (t, end) {
    const plan = tspl(t, { plan: count * values.length })
    _test({ plan, t, name: '[no-tx]', i: 0 })
      .catch(function (err) {
        plan.ok(!err)
      })
      .then(end)
  })

  function _test({ plan, t, name, i }) {
    const { Promise } = t.nr
    const value = values[i]
    return factory({ Promise, name, value, plan }).then(function () {
      if (++i < values.length) {
        return _test({ plan, t, name, i })
      }
    })
  }
}

function testResolveBehavior(method) {
  test('Promise.' + method, async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await testPromiseContext({
      t,
      factory: function (Promise, name) {
        return Promise[method](name)
      }
    })

    await t.test('usage', function (t, end) {
      const { Promise } = t.nr
      testPromiseClassMethod({
        t,
        end,
        count: 1,
        testFunc: function tryTest({ plan, name }) {
          return Promise[method](name + ' ' + method + ' value').then(function (res) {
            plan.equal(res, name + ' ' + method + ' value', name + 'should pass the value')
          })
        }
      })
    })

    await testPromiseClassCastMethod({
      t,
      count: 1,
      testFunc: function ({ plan, Promise, value }) {
        return Promise[method](value).then(function (val) {
          plan.deepEqual(val, value, 'should have expected value')
        })
      }
    })
  })
}

function testFromCallbackBehavior(methodName) {
  test('Promise.' + methodName, async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await testPromiseContext({
      t,
      factory: function (Promise, name) {
        return Promise[methodName](function (cb) {
          addTask(t.nr, cb, null, name)
        })
      }
    })

    await t.test('usage', function (t, end) {
      const { Promise } = t.nr
      testPromiseClassMethod({
        t,
        end,
        count: 3,
        testFunc: function tryTest({ plan, name }) {
          return Promise[methodName](function (cb) {
            addTask(t.nr, cb, null, 'foobar ' + name)
          })
            .then(function (res) {
              plan.equal(res, 'foobar ' + name, name + 'should pass result through')

              return Promise[methodName](function (cb) {
                addTask(t.nr, cb, new Error('Promise.' + methodName + ' test error'))
              })
            })
            .then(
              function () {
                plan.ok(0, name + 'should not resolve after rejecting')
              },
              function (err) {
                plan.ok(err, name + 'should have an error')
                plan.equal(
                  err.message,
                  'Promise.' + methodName + ' test error',
                  name + 'should have correct error'
                )
              }
            )
        }
      })
    })
  })
}

function testFinallyBehavior(methodName) {
  test('Promise#' + methodName, async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await testPromiseContext({
      t,
      factory: function (Promise, name) {
        return Promise.resolve(name)[methodName](function () {})
      }
    })

    await t.test('usage', function (t, end) {
      testPromiseInstanceMethod({
        t,
        end,
        count: 6,
        testFunc: function throwTest({ plan, name, promise }) {
          return promise[methodName](function () {
            plan.equal(arguments.length, 0, name + 'should not receive any parameters')
          })
            .then(function (res) {
              plan.deepEqual(
                res,
                [1, 2, 3, name],
                name + 'should pass values beyond ' + methodName + ' handler'
              )
              throw new Error('Promise#' + methodName + ' test error')
            })
            [methodName](function () {
              plan.equal(arguments.length, 0, name + 'should not receive any parameters')
              plan.ok(1, name + 'should go into ' + methodName + ' handler from rejected promise')
            })
            .catch(function (err) {
              plan.ok(err, name + 'should pass error beyond ' + methodName + ' handler')
              plan.equal(
                err.message,
                'Promise#' + methodName + ' test error',
                name + 'should be correct error'
              )
            })
        }
      })
    })
  })
}

function testRejectBehavior(method) {
  test('Promise.' + method, async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await testPromiseContext({
      t,
      factory: function (Promise, name) {
        return Promise[method](name)
      }
    })

    await t.test('usage', function (t, end) {
      const { Promise } = t.nr
      testPromiseClassMethod({
        t,
        end,
        count: 1,
        testFunc: function rejectTest({ plan, name }) {
          return Promise[method](name + ' ' + method + ' value').then(
            function () {
              plan.ok(0, name + 'should not resolve after a rejection')
            },
            function (err) {
              plan.equal(err, name + ' ' + method + ' value', name + 'should reject with the err')
            }
          )
        }
      })
    })

    await testPromiseClassCastMethod({
      t,
      count: 1,
      testFunc: function ({ plan, Promise, name, value }) {
        return Promise[method](value).then(
          function () {
            plan.ok(0, name + 'should not resolve after a rejection')
          },
          function (err) {
            plan.equal(err, value, name + 'should reject with correct error')
          }
        )
      }
    })
  })
}

function testAsCallbackBehavior(methodName) {
  test('Promise#' + methodName, async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await testPromiseContext({
      t,
      factory: function (Promise, name) {
        return Promise.resolve(name)[methodName](function () {})
      }
    })

    await t.test('usage', function (t, end) {
      const { agent } = t.nr
      testPromiseInstanceMethod({
        t,
        end,
        count: 8,
        testFunc: function asCallbackTest({ plan, name, promise }) {
          const startTransaction = agent.getTransaction()
          return promise[methodName](function (err, result) {
            const inCallbackTransaction = agent.getTransaction()
            plan.equal(
              id(startTransaction),
              id(inCallbackTransaction),
              name + 'should have the same transaction inside the success callback'
            )
            plan.ok(!err)
            plan.deepEqual(result, [1, 2, 3, name], name + 'should have the correct result value')
          })
            .then(function () {
              throw new Error('Promise#' + methodName + ' test error')
            })
            .then(function () {
              plan.ok(0, name + 'should have skipped then after rejection')
            })
            [methodName](function (err, result) {
              const inCallbackTransaction = agent.getTransaction()
              plan.equal(
                id(startTransaction),
                id(inCallbackTransaction),
                name + 'should have the same transaction inside the error callback'
              )
              plan.ok(err, name + 'should have error in ' + methodName)
              plan.ok(!result, name + 'should not have a result')
              plan.equal(
                err.message,
                'Promise#' + methodName + ' test error',
                name + 'should be the correct error'
              )
            })
            .catch(function (err) {
              plan.ok(err, name + 'should have error in catch too')
              // Swallowing error that doesn't get caught in the asCallback/nodeify.
            })
        }
      })
    })
  })
}

function testCatchBehavior(methodName) {
  test('Promise#' + methodName, async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await testPromiseContext({
      t,
      factory: function (Promise, name) {
        return Promise.reject(new Error(name))[methodName](function (err) {
          return err
        })
      }
    })

    await t.test('usage', function (t, end) {
      testPromiseInstanceMethod({
        t,
        end,
        count: 2,
        testFunc: function asCallbackTest({ plan, name, promise }) {
          return promise[methodName](function (err) {
            plan.ok(!err)
          })
            .then(function () {
              throw new Error('Promise#' + methodName + ' test error')
            })
            [methodName](function (err) {
              plan.ok(err, name + 'should pass error into rejection handler')
              plan.equal(
                err.message,
                'Promise#' + methodName + ' test error',
                name + 'should be correct error'
              )
            })
        }
      })
    })
  })
}

module.exports = {
  testAsCallbackBehavior,
  testCatchBehavior,
  testFinallyBehavior,
  testPromiseClassCastMethod,
  testPromiseInstanceCastMethod,
  testPromiseContext,
  testRejectBehavior,
  testResolveBehavior,
  testFromCallbackBehavior,
  testTryBehavior,
  testThrowBehavior
}
