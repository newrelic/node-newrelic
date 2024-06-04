/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const TEST_DIR = '../../integration/instrumentation/promises/'
const testPromiseSegments = require(`${TEST_DIR}/legacy-promise-segments`)
const testTransactionState = require(`${TEST_DIR}/transaction-state`)

// grab process emit before tap / async-hooks-domain can mess with it
const originalEmit = process.emit

const tap = require('tap')
const test = tap.test

const runMultiple = testTransactionState.runMultiple

test('Promise constructor retains all properties', function (t) {
  let Promise = require('when').Promise
  const originalKeys = Object.keys(Promise)

  setupAgent(t)
  Promise = require('when').Promise
  const wrappedKeys = Object.keys(Promise)

  originalKeys.forEach(function (key) {
    if (wrappedKeys.indexOf(key) === -1) {
      t.fail('Property ' + key + ' is not present on wrapped Promise')
    }
  })

  t.end()
})

test('transaction state', function (t) {
  const agent = setupAgent(t)
  const when = require('when')
  testTransactionState(t, agent, when.Promise, when)
  t.autoend()
})

test('segments', function (t) {
  const agent = setupAgent(t)
  const when = require('when')
  testPromiseSegments(t, agent, when.Promise)
  t.autoend()
})

test('no transaction', function (t) {
  setupAgent(t)
  const when = require('when')

  when
    .resolve(0)
    .then(function step1() {
      return 1
    })
    .then(function step2() {
      return 2
    })
    .then(function finalHandler(res) {
      t.equal(res, 2, 'should be the correct result')
    })
    .finally(function finallyHandler() {
      t.end()
    })
})

test('new Promise() throw', function (t) {
  t.plan(2)

  const Promise = require('when').Promise

  try {
    new Promise(function () {
      throw new Error('test error')
    }).then(
      function () {
        t.fail('Error should have been caught.')
      },
      function (err) {
        t.ok(err, 'Error should go to the reject handler')
        t.equal(err.message, 'test error', 'Error should be as expected')
        t.end()
      }
    )
  } catch (e) {
    t.fail('Error should have passed to `reject`.')
  }
})

test('new Promise() resolve then throw', function (t) {
  t.plan(1)

  const Promise = require('when').Promise

  try {
    new Promise(function (resolve) {
      resolve('foo')
      throw new Error('test error')
    }).then(
      function (res) {
        t.equal(res, 'foo', 'promise should be resolved.')
        t.end()
      },
      function () {
        t.fail('Error should have been swallowed by promise.')
      }
    )
  } catch (e) {
    t.fail('Error should have passed to `reject`.')
  }
})

test('when()', function (t) {
  testPromiseLibraryMethod(t, 2, function (when, name) {
    return when(name).then(function (x) {
      t.equal(x, name, name + 'should pass the value')

      return when(when.reject(new Error(name + 'error message')))
        .then(function () {
          t.fail(name + 'should not call resolve handler after throwing')
        })
        .catch(function (err) {
          t.equal(err.message, name + 'error message', name + 'should have correct error')
        })
    })
  })
})

test('when.defer', function (t) {
  testPromiseLibraryMethod(t, 2, function (when, name) {
    const defer = when.defer()
    process.nextTick(function () {
      defer.resolve(name + 'resolve value')
    })

    return defer.promise.then(function (x) {
      t.equal(x, name + 'resolve value', name + 'should have correct value')

      const defer2 = when.defer()
      defer2.reject(new Error(name + 'error message'))
      return defer2.promise
        .then(function () {
          t.fail(name + 'should not call resolve handler after throwing')
        })
        .catch(function (err) {
          t.equal(err.message, name + 'error message', name + 'should have correct error')
        })
    })
  })
})

test('when debug API', function (t) {
  helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

  t.plan(2)
  setupAgent(t)
  const when = require('when')

  t.test('should not break onFatalRejection', function (t) {
    helper.temporarilyRemoveListeners(t, process, 'unhandledRejection')

    const error = { val: 'test' }
    when.Promise.onFatalRejection = function testFatal(e) {
      t.equal(e.value, error)
      t.end()
    }

    const p = when.reject(error)

    p.done()
  })

  t.test('should not break onPotentiallyUnhandledRejectionHandled', function (t) {
    t.plan(2)
    helper.temporarilyRemoveListeners(t, process, 'unhandledRejection')

    // avoid async hook domain emit so `when` can behave normally.
    // seems like *should not* have negative consequences but it may.
    // https://github.com/isaacs/async-hook-domain/issues/3
    const asyncHookDomainEmit = process.emit
    process.emit = (event, ...args) => {
      return originalEmit.call(process, event, ...args)
    }

    t.teardown(() => {
      process.emit = asyncHookDomainEmit
    })

    const error = { val: 'test' }
    when.Promise.onPotentiallyUnhandledRejectionHandled = function testOPURH(e) {
      t.equal(e.value, error, 'should have passed error through')
      t.end()
    }

    when.Promise.onPotentiallyUnhandledRejection = function testOPUR(e) {
      t.equal(e.value, error, 'should pass error though')
    }

    const p = when.reject(error)

    setTimeout(function () {
      p.catch(function () {})
    }, 10)
  })
})

test('when.iterate', function (t) {
  const COUNT = 10
  testPromiseLibraryMethod(t, COUNT * 6 + 2, function (when, name) {
    const agent = helper.getAgent()
    const transaction = agent.getTransaction()

    let incrementerCount = 0
    let predicateCount = 0
    let bodyCount = 0
    return when.iterate(
      function (x) {
        t.equal(
          agent.getTransaction(),
          transaction,
          name + 'iterator has correct transaction state'
        )

        t.equal(incrementerCount++, x++, name + 'should iterate as expected')
        return x
      },
      function (x) {
        t.equal(
          agent.getTransaction(),
          transaction,
          name + 'predicate has correct transaction state'
        )

        t.equal(predicateCount++, x, name + 'should execute predicate each time')
        return x >= COUNT // true to stop!?
      },
      function (x) {
        t.equal(agent.getTransaction(), transaction, name + 'body has correct transaction state')

        t.equal(bodyCount++, x, name + 'should execute body each time')
      },
      0
    )
  })
})

test('when.join', function (t) {
  testPromiseLibraryMethod(t, 2, function (when, name) {
    return when.join(2, when.resolve(name)).then(function (x) {
      t.same(x, [2, name], name + 'should resolve with correct value')

      return when
        .join(2, when.reject(new Error(name + 'error message')))
        .then(function () {
          t.fail(name + 'should not call resolve handler after throwing')
        })
        .catch(function (err) {
          t.equal(err.message, name + 'error message', name + 'should have correct error')
        })
    })
  })
})

test('when.lift', function (t) {
  testPromiseLibraryMethod(t, 2, function (when, name) {
    const func = when.lift(function (x) {
      if (x instanceof Error) {
        throw x
      }
      return x
    })

    return func(name + 'return value').then(function (x) {
      t.equal(x, name + 'return value', name + 'should pass return value')

      return func(new Error(name + 'error message'))
        .then(function () {
          t.fail(name + 'should not call resolve handler after throwing')
        })
        .catch(function (err) {
          t.equal(err.message, name + 'error message', name + 'should have correct error')
        })
    })
  })
})

test('when.promise', function (t) {
  testPromiseLibraryMethod(t, 2, function (when, name) {
    return when
      .promise(function (resolve) {
        resolve(name + 'resolve value')
      })
      .then(function (x) {
        t.equal(x, name + 'resolve value', name + 'should pass the value')

        return when.promise(function (resolve, reject) {
          reject(name + 'reject value')
        })
      })
      .then(
        function () {
          t.fail(name + 'should not call resolve handler after rejection')
        },
        function (x) {
          t.equal(x, name + 'reject value', name + 'should pass the value')
        }
      )
  })
})

test('when.resolve', function (t) {
  testPromiseLibraryMethod(t, 1, function (when, name) {
    return when.resolve(name + 'resolve value').then(function (res) {
      t.equal(res, name + 'resolve value', name + 'should pass the value')
    })
  })
})

test('when.reject', function (t) {
  testPromiseLibraryMethod(t, 1, function (when, name) {
    return when
      .reject(name + 'reject value')
      .then(function () {
        t.fail(name + 'should not resolve after a rejection')
      })
      .catch(function (err) {
        t.equal(err, name + 'reject value', name + 'should reject with the err')
      })
  })
})
;['try', 'attempt'].forEach(function (method) {
  test('when.' + method, function (t) {
    testPromiseLibraryMethod(t, 3, function (when, name) {
      return when[method](function (x) {
        t.equal(x, name + '' + method, name + 'should receive values')
        return name + 'return value'
      }, name + '' + method).then(function (x) {
        t.equal(x, name + 'return value', name + 'should pass result through')

        return when[method](function () {
          throw new Error(name + 'error message')
        })
          .then(function () {
            t.fail(name + 'should not call resolve handler after throwing')
          })
          .catch(function (err) {
            t.equal(err.message, name + 'error message', name + 'should have correct error')
          })
      })
    })
  })
})

test('Promise.resolve', function (t) {
  testPromiseClassMethod(t, 1, function resolveTest(Promise, name) {
    return Promise.resolve(name + 'resolve value').then(function (res) {
      t.equal(res, name + 'resolve value', name + 'should pass the value')
    })
  })
})

test('Promise.reject', function (t) {
  testPromiseClassMethod(t, 1, function rejectTest(Promise, name) {
    return Promise.reject(name + 'reject value')
      .then(function () {
        t.fail(name + 'should not resolve after a rejection')
      })
      .catch(function (err) {
        t.equal(err, name + 'reject value', name + 'should reject with the err')
      })
  })
})

test('Promise#done', function (t) {
  testPromiseClassMethod(t, 3, function (Promise, name) {
    return new Promise(function (resolve, reject) {
      const ret = Promise.resolve(name + 'resolve value').done(resolve, reject)
      t.equal(ret, undefined, name + 'should not return a promise from #done')
    })
      .then(function (x) {
        t.equal(x, name + 'resolve value', name + 'should resolve correctly')
      })
      .then(function () {
        return new Promise(function (resolve, reject) {
          Promise.reject(new Error(name + 'error message')).done(resolve, reject)
        })
      })
      .then(function () {
        t.fail(name + 'should not resolve after rejection')
      })
      .catch(function (err) {
        t.equal(err.message, name + 'error message', name + 'should have correct error')
      })
  })
})

test('Promise#then', function (t) {
  testPromiseInstanceMethod(t, 3, function thenTest(p, name) {
    return p
      .then(function (res) {
        t.same(res, [1, 2, 3, name], name + 'should have the correct result value')
        throw new Error('Promise#then test error')
      })
      .then(
        function () {
          t.fail(name + 'should not go into resolve handler from rejected promise')
        },
        function (err) {
          t.ok(err, name + 'should pass error into thenned rejection handler')
          if (err) {
            t.equal(err.message, 'Promise#then test error', name + 'should be correct error')
          }
        }
      )
  })
})

test('Promise#catch', function (t) {
  testPromiseInstanceMethod(t, 2, function catchTest(p, name) {
    return p
      .catch(function () {
        t.fail(name + 'should not go into catch from a resolved promise')
      })
      .then(function () {
        throw new Error('Promise#catch test error')
      })
      .catch(function (err) {
        t.ok(err, name + 'should pass error into rejection handler')
        if (err) {
          t.equal(err.message, 'Promise#catch test error', name + 'should be correct error')
        }
      })
  })
})

test('Promise#otherwise', function (t) {
  testPromiseInstanceMethod(t, 2, function otherwiseTest(p, name) {
    return p
      .otherwise(function () {
        t.fail(name + 'should not go into otherwise from a resolved promise')
      })
      .then(function () {
        throw new Error(name + ' test error')
      })
      .otherwise(function (err) {
        t.ok(err, name + 'should pass error into rejection handler')
        if (err) {
          t.equal(err.message, name + ' test error', name + 'should be correct error')
        }
      })
  })
})

test('Promise#finally', function (t) {
  testPromiseInstanceMethod(t, 6, function finallyTest(p, name) {
    return p
      .finally(function () {
        t.equal(arguments.length, 0, name + 'should not receive any parameters')
      })
      .then(function (res) {
        t.same(res, [1, 2, 3, name], name + 'should pass values beyond finally handler')
        throw new Error('Promise#finally test error')
      })
      .finally(function () {
        t.equal(arguments.length, 0, name + 'should not receive any parameters')
        t.pass(name + 'should go into finally handler from rejected promise')
      })
      .catch(function (err) {
        t.ok(err, name + 'should pass error beyond finally handler')
        if (err) {
          t.equal(err.message, 'Promise#finally test error', name + 'should be correct error')
        }
      })
  })
})

test('Promise#ensure', function (t) {
  testPromiseInstanceMethod(t, 6, function ensureTest(p, name) {
    return p
      .ensure(function () {
        t.equal(arguments.length, 0, name + 'should not receive any parameters')
      })
      .then(function (res) {
        t.same(res, [1, 2, 3, name], name + 'should pass values beyond ensure handler')
        throw new Error('Promise#ensure test error')
      })
      .ensure(function () {
        t.equal(arguments.length, 0, name + 'should not receive any parameters')
        t.pass(name + 'should go into ensure handler from rejected promise')
      })
      .catch(function (err) {
        t.ok(err, name + 'should pass error beyond ensure handler')
        if (err) {
          t.equal(err.message, 'Promise#ensure test error', name + 'should be correct error')
        }
      })
  })
})

test('Promise#tap', function (t) {
  testPromiseInstanceMethod(t, 4, function tapTest(p, name) {
    return p
      .tap(function (res) {
        t.same(res, [1, 2, 3, name], name + 'should pass values into tap handler')
      })
      .then(function (res) {
        t.same(res, [1, 2, 3, name], name + 'should pass values beyond tap handler')
        throw new Error('Promise#tap test error')
      })
      .tap(function () {
        t.fail(name + 'should not call tap after rejected promises')
      })
      .catch(function (err) {
        t.ok(err, name + 'should pass error beyond tap handler')
        if (err) {
          t.equal(err.message, 'Promise#tap test error', name + 'should be correct error')
        }
      })
  })
})

test('Promise#spread', function (t) {
  testPromiseInstanceMethod(t, 1, function spreadTest(p, name) {
    return p.spread(function (a, b, c, d) {
      t.same([a, b, c, d], [1, 2, 3, name], name + 'parameters should be correct')
    })
  })
})

test('Promise#fold', function (t) {
  testPromiseInstanceMethod(t, 3, function (p, name) {
    return p
      .fold(
        function (a, b) {
          t.equal(a, name, name + 'first parameter should be second promise')
          t.same(b, [1, 2, 3, name], name + 'second parameter should be first promise')

          return [a, b]
        },
        p.then(function () {
          return name
        })
      )
      .then(function (x) {
        t.same(x, [name, [1, 2, 3, name]], name + 'should have correct parameters')
      })
  })
})

test('Promise#yield', function (t) {
  testPromiseInstanceMethod(t, 1, function (p, name) {
    return p.yield(name + 'yield value').then(function (x) {
      t.equal(x, name + 'yield value', name + 'should have correct value')
    })
  })
})
;['else', 'orElse'].forEach(function (method) {
  test('Promise#' + method, function (t) {
    testPromiseInstanceMethod(t, 2, function (p, name) {
      return p[method](new Error(name + 'skipped else message'))
        .then(
          function (x) {
            t.same(x, [1, 2, 3, name], name + 'should pass value through the else')
          },
          function () {
            t.fail(name + 'should not have rejected first promise')
          }
        )
        .then(function () {
          throw new Error(name + 'original error')
        })
        [method](name + 'elsed value')
        .then(function (x) {
          t.equal(x, name + 'elsed value', name + 'should resolve with else value')
        })
    })
  })
})

test('Promise#delay', function (t) {
  testPromiseInstanceMethod(t, 2, function (p, name) {
    const start = Date.now()
    return p.delay(100).then(function (x) {
      const end = Date.now()
      t.same(x, [1, 2, 3, name], name + 'should resolve with original promise')
      t.ok(end - start >= 100, name + 'should delay at least the specified duration')
    })
  })
})

test('Promise#timeout', function (t) {
  testPromiseInstanceMethod(t, 3, function (p, name) {
    const start = Date.now()
    return p
      .delay(100)
      .timeout(50, new Error(name + 'timeout message'))
      .then(function () {
        t.fail(name + 'should not have resolved')
      })
      .catch(function (err) {
        const end = Date.now()
        t.equal(err.message, name + 'timeout message', name + 'should have correct message')
        t.ok(end - start > 48, name + 'should wait close to correct time')
        t.ok(end - start < 75, name + 'should wait close to correct time')
      })
  })
})

test('Promise#with', function (t) {
  testPromiseInstanceMethod(t, 2, function (p, name) {
    const obj = {}
    return p.with(obj).then(function (x) {
      t.same(x, [1, 2, 3, name], name + 'should resolve with correct value')
      t.equal(this, obj, name + 'should have correct context')
    })
  })
})

test('all', function (t) {
  t.autoend()
  let agent
  let when
  let Promise
  let p1
  let p2

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({ feature_flag: { promise_segments: false } })
    when = require('when')
    Promise = when.Promise

    p1 = new Promise(function (resolve) {
      resolve(1)
    })
    p2 = new Promise(function (resolve) {
      resolve(2)
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('on library', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when.all([p1, p2]).then(function () {
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })

  t.test('on Promise', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.all([p1, p2]).then(function () {
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('any', function (t) {
  t.autoend()
  let agent
  let when
  let Promise

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({ feature_flag: { promise_segments: false } })
    when = require('when')
    Promise = when.Promise
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('on library', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when.any([when.resolve(1), when.resolve(2)]).then(function (result) {
        t.equal(result, 1)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })

  t.test('on Promise', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.any([when.resolve(1), when.resolve(2)]).then(function (result) {
        t.equal(result, 1)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('some', function (t) {
  t.autoend()
  let agent
  let when
  let Promise

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({ feature_flag: { promise_segments: false } })
    when = require('when')
    Promise = when.Promise
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('on library', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when.some([when.resolve(1), when.resolve(2), when.resolve(3)], 2).then(function (result) {
        t.equal(result.length, 2)
        t.equal(result[0], 1)
        t.equal(result[1], 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })

  t.test('on Promise', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.some([when.resolve(1), when.resolve(2), when.resolve(3)], 2).then(function (result) {
        t.equal(result.length, 2)
        t.equal(result[0], 1)
        t.equal(result[1], 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('map', function (t) {
  t.autoend()
  let agent
  let when
  let Promise

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({ feature_flag: { promise_segments: false } })
    when = require('when')
    Promise = when.Promise
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('on library', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when
        .map([1, 2], function (item) {
          return when.resolve(item)
        })
        .then(function (result) {
          t.equal(result.length, 2)
          t.equal(result[0], 1)
          t.equal(result[1], 2)
          t.equal(agent.getTransaction(), transaction, 'has the right transaction')
          t.end()
        })
    })
  })

  t.test('on Promise', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.map([1, 2], function (item) {
        return when.resolve(item)
      }).then(function (result) {
        t.equal(result.length, 2)
        t.equal(result[0], 1)
        t.equal(result[1], 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('reduce', function (t) {
  t.autoend()
  let agent
  let when
  let Promise

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({ feature_flag: { promise_segments: false } })
    when = require('when')
    Promise = when.Promise
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('on library', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when
        .reduce(
          [1, 2],
          function (total, item) {
            return when.resolve(item).then(function (result) {
              return total + result
            })
          },
          0
        )
        .then(function (total) {
          t.equal(total, 3)
          t.equal(agent.getTransaction(), transaction, 'has the right transaction')
          t.end()
        })
    })
  })

  t.test('on Promise', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.reduce(
        [1, 2],
        function (total, item) {
          return when.resolve(item).then(function (result) {
            return total + result
          })
        },
        0
      ).then(function (total) {
        t.equal(total, 3)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('filter', function (t) {
  t.autoend()
  let agent
  let when
  let Promise

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({ feature_flag: { promise_segments: false } })
    when = require('when')
    Promise = when.Promise
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('on library', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when
        .filter([1, 2, 3, 4], function (value) {
          // filter out even numbers
          return value % 2
        })
        .then(function (result) {
          t.equal(result.length, 2)
          t.equal(agent.getTransaction(), transaction, 'has the right transaction')
          t.end()
        })
    })
  })

  t.test('on Promise', function (t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.filter([1, 2, 3, 4], function (value) {
        // filter out even numbers
        return value % 2
      }).then(function (result) {
        t.equal(result.length, 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('fn.apply', function (t) {
  setupAgent(t)

  require('when')
  const fn = require('when/function')

  function noop() {}

  const args = [1, 2, 3]
  fn.apply(noop, args).then(function () {
    t.end()
  })
})

test('node.apply', function (t) {
  setupAgent(t)

  require('when')
  const nodefn = require('when/node')

  function nodeStyleFunction(arg1, cb) {
    process.nextTick(cb)
  }

  const args = [1]
  nodefn
    .apply(nodeStyleFunction, args)
    .then(function () {
      t.end()
    })
    .catch(function (err) {
      t.fail(err)
    })
})

function setupAgent(t, enableSegments) {
  const agent = helper.instrumentMockedAgent({
    feature_flag: { promise_segments: enableSegments }
  })
  t.teardown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}

function testPromiseInstanceMethod(t, plan, testFunc) {
  const agent = setupAgent(t)
  const Promise = require('when').Promise

  _testPromiseMethod(t, plan, agent, function (name) {
    const p = new Promise(function (resolve) {
      resolve([1, 2, 3, name])
    })
    return testFunc(p, name, agent)
  })
}

function testPromiseClassMethod(t, plan, testFunc) {
  const agent = setupAgent(t)
  const when = require('when')
  const Promise = when.Promise

  _testPromiseMethod(t, plan, agent, function (name) {
    return testFunc(Promise, name)
  })
}

function testPromiseLibraryMethod(t, plan, testFunc) {
  const agent = setupAgent(t)
  const when = require('when')

  _testPromiseMethod(t, plan, agent, function (name) {
    return testFunc(when, name)
  })
}

function _testPromiseMethod(t, plan, agent, testFunc) {
  const COUNT = 2
  t.plan(plan * 3 + (COUNT + 1) * 3)

  t.doesNotThrow(function outTXPromiseThrowTest() {
    const name = '[no tx] '
    let isAsync = false
    testFunc(name)
      .finally(function () {
        t.ok(isAsync, name + 'should have executed asynchronously')
      })
      .then(
        function () {
          t.notOk(agent.getTransaction(), name + 'has no transaction')
          testInTransaction()
        },
        function (err) {
          if (err) {
            /* eslint-disable no-console */
            console.log(err)
            console.log(err.stack)
            /* eslint-enable no-console */
          }
          t.notOk(err, name + 'should not result in error')
          t.end()
        }
      )
    isAsync = true
  }, '[no tx] should not throw out of a transaction')

  function testInTransaction() {
    runMultiple(
      COUNT,
      function (i, cb) {
        helper.runInTransaction(agent, function transactionWrapper(transaction) {
          const name = '[tx ' + i + '] '
          t.doesNotThrow(function inTXPromiseThrowTest() {
            let isAsync = false
            testFunc(name)
              .finally(function () {
                t.ok(isAsync, name + 'should have executed asynchronously')
              })
              .then(
                function () {
                  t.equal(agent.getTransaction(), transaction, name + 'has the right transaction')
                },
                function (err) {
                  if (err) {
                    /* eslint-disable no-console */
                    console.log(err)
                    console.log(err.stack)
                    /* eslint-enable no-console */
                  }
                  t.notOk(err, name + 'should not result in error')
                }
              )
              .finally(cb)
            isAsync = true
          }, name + 'should not throw in a transaction')
        })
      },
      function () {
        t.end()
      }
    )
  }
}
