/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const semver = require('semver')
const symbols = require('../../../lib/symbols')
const helper = require('../../lib/agent_helper')
const {
  testAsCallbackBehavior,
  testCatchBehavior,
  testFinallyBehavior,
  testFromCallbackBehavior,
  testPromiseContext,
  testRejectBehavior,
  testResolveBehavior,
  testThrowBehavior,
  testTryBehavior,
  testPromiseClassCastMethod,
  testPromiseInstanceCastMethod
} = require('./common-tests')
const {
  addTask,
  afterEach,
  areMethodsWrapped,
  beforeEach,
  testPromiseClassMethod,
  testPromiseInstanceMethod
} = require('./helpers')
const { version: pkgVersion } = require('bluebird/package')

testTryBehavior('try')
testTryBehavior('attempt')
testResolveBehavior('cast')
testResolveBehavior('fulfilled')
testResolveBehavior('resolve')
testThrowBehavior('thenThrow')
testThrowBehavior('throw')
testFromCallbackBehavior('fromCallback')
testFromCallbackBehavior('fromNode')
testFinallyBehavior('finally')
testFinallyBehavior('lastly')
testRejectBehavior('reject')
testRejectBehavior('rejected')
testAsCallbackBehavior('asCallback')
testAsCallbackBehavior('nodeify')
testCatchBehavior('catch')
testCatchBehavior('caught')

test('new Promise()', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('throw', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 2,
      testFunc: function throwTest({ name, plan }) {
        try {
          return new Promise(function () {
            throw new Error(name + ' test error')
          }).then(
            function () {
              plan.ok(0, `${name} Error should have been caught`)
            },
            function (err) {
              plan.ok(err, name + ' Error should go to the reject handler')
              plan.equal(err.message, name + ' test error', name + ' Error should be as expected')
            }
          )
        } catch (e) {
          plan.ok(!e)
        }
      }
    })
  })

  await t.test('resolve then throw', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function resolveThrowTest({ name, plan }) {
        try {
          return new Promise(function (resolve) {
            resolve(name + ' foo')
            throw new Error(name + ' test error')
          }).then(
            function (res) {
              plan.equal(res, name + ' foo', name + ' promise should be resolved.')
            },
            function () {
              plan.ok(0, `${name} Error should have been caught`)
            }
          )
        } catch (e) {
          plan.ok(!e)
        }
      }
    })
  })

  await t.test('resolve usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 3,
      testFunc: function resolveTest({ name, plan }) {
        const contextManager = helper.getContextManager()
        const inTx = !!contextManager.getContext()

        return new Promise(function (resolve) {
          addTask(t.nr, function () {
            plan.ok(!contextManager.getContext(), name + 'should lose tx')
            resolve('foobar ' + name)
          })
        }).then(function (res) {
          if (inTx) {
            plan.ok(contextManager.getContext(), name + 'should return tx')
          } else {
            plan.ok(!contextManager.getContext(), name + 'should not create tx')
          }
          plan.equal(res, 'foobar ' + name, name + 'should resolve with correct value')
        })
      }
    })
  })

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return new Promise((resolve) => resolve(name))
    }
  })
})

test('Promise.all', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      count: 1,
      end,
      testFunc: function ({ name, plan }) {
        const p1 = Promise.resolve(name + '1')
        const p2 = Promise.resolve(name + '2')

        return Promise.all([p1, p2]).then(function (result) {
          plan.deepEqual(result, [name + '1', name + '2'], name + 'should not change result')
        })
      }
    })
  })

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.all([name])
    }
  })
})

test('Promise.allSettled', { skip: semver.lt(pkgVersion, '3.7.0') }, async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.allSettled([Promise.resolve(name), Promise.reject(name)])
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      count: 1,
      end,
      testFunc: function ({ name, plan }) {
        const p1 = Promise.resolve(name + '1')
        const p2 = Promise.reject(name + '2')

        return Promise.allSettled([p1, p2]).then(function (inspections) {
          const result = inspections.map(function (i) {
            return i.isFulfilled() ? { value: i.value() } : { reason: i.reason() }
          })
          plan.deepEqual(
            result,
            [{ value: name + '1' }, { reason: name + '2' }],
            name + 'should not change result'
          )
        })
      }
    })
  })
})

test('Promise.any', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.any([name])
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.any([
          Promise.reject(name + 'rejection!'),
          Promise.resolve(name + 'resolved'),
          Promise.delay(15, name + 'delayed')
        ]).then(function (result) {
          plan.equal(result, name + 'resolved', 'should not change the result')
        })
      }
    })
  })
})

test('Promise.bind', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.bind(name)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 2,
      testFunc: function ({ plan, name }) {
        const ctx = {}
        return Promise.bind(ctx, name).then(function (value) {
          plan.equal(this, ctx, 'should have expected `this` value')
          plan.equal(value, name, 'should not change passed value')
        })
      }
    })
  })

  await testPromiseClassCastMethod({
    t,
    count: 4,
    testFunc: function ({ plan, Promise, name, value }) {
      return Promise.bind(value, name).then(function (ctx) {
        plan.equal(this, value, 'should have expected `this` value')
        plan.equal(ctx, name, 'should not change passed value')

        // Try with this context type in both positions.
        return Promise.bind(name, value).then(function (val2) {
          plan.equal(this, name, 'should have expected `this` value')
          plan.equal(val2, value, 'should not change passed value')
        })
      })
    }
  })
})

test('Promise.coroutine', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.coroutine(function* (_name) {
        for (let i = 0; i < 10; ++i) {
          yield Promise.delay(5)
        }
        return _name
      })(name)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, name }) {
        let count = 0

        plan.doesNotThrow(function () {
          Promise.coroutine.addYieldHandler(function (value) {
            if (value === name) {
              plan.ok(1, 'should call yield handler')
              return Promise.resolve(value + ' yielded')
            }
          })
        }, 'should be able to add yield handler')

        return Promise.coroutine(function* (_name) {
          for (let i = 0; i < 10; ++i) {
            yield Promise.delay(5)
            ++count
          }
          return yield _name
        })(name).then(function (result) {
          plan.equal(count, 10, 'should step through whole coroutine')
          plan.equal(result, name + ' yielded', 'should pass through resolve value')
        })
      }
    })
  })
})

test('Promise.delay', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.delay(5, name)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, name }) {
        const DELAY = 500
        const MARGIN = 100
        const start = Date.now()
        return Promise.delay(DELAY, name).then(function (result) {
          const duration = Date.now() - start
          plan.ok(duration < DELAY + MARGIN, 'should not take more than expected time')
          plan.ok(duration > DELAY - MARGIN, 'should not take less than expected time')
          plan.equal(result, name, 'should pass through resolve value')
        })
      }
    })
  })

  await testPromiseClassCastMethod({
    t,
    count: 1,
    testFunc: function ({ plan, Promise, value }) {
      return Promise.delay(5, value).then(function (val) {
        plan.equal(val, value, 'should have expected value')
      })
    }
  })
})

test('Promise.each', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.each([name], function () {})
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 5,
      testFunc: function ({ plan, name }) {
        return Promise.each(
          [
            Promise.resolve(name + '1'),
            Promise.resolve(name + '2'),
            Promise.resolve(name + '3'),
            Promise.resolve(name + '4')
          ],
          function (value, i) {
            plan.equal(value, name + (i + 1), 'should not change input to iterator')
          }
        ).then(function (result) {
          plan.deepEqual(result, [name + '1', name + '2', name + '3', name + '4'])
        })
      }
    })
  })
})

test('Promise.filter', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.filter([name], function () {
        return true
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.filter(
          [
            Promise.resolve(name + '1'),
            Promise.resolve(name + '2'),
            Promise.resolve(name + '3'),
            Promise.resolve(name + '4')
          ],
          function (value) {
            return Promise.resolve(/[24]$/.test(value))
          }
        ).then(function (result) {
          plan.deepEqual(result, [name + '2', name + '4'], 'should not change the result')
        })
      }
    })
  })
})

test('Promise.getNewLibraryCopy', { skip: semver.lt(pkgVersion, '3.4.1') }, function (t) {
  helper.loadTestAgent(t)
  const Promise = require('bluebird')
  const Promise2 = Promise.getNewLibraryCopy()

  assert.ok(Promise2.resolve[symbols.original], 'should have wrapped class methods')
  assert.ok(Promise2.prototype.then[symbols.original], 'should have wrapped instance methods')
})

test('Promise.is', function (t) {
  helper.loadTestAgent(t)
  const Promise = require('bluebird')

  let p = new Promise(function (resolve) {
    setImmediate(resolve)
  })
  assert.ok(Promise.is(p), 'should not break promise identification (new)')

  p = p.then(function () {})
  assert.ok(Promise.is(p), 'should not break promise identification (then)')
})

test('Promise.join', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.join(name)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.join(
          Promise.resolve(1),
          Promise.resolve(2),
          Promise.resolve(3),
          Promise.resolve(name)
        ).then(function (res) {
          plan.deepEqual(res, [1, 2, 3, name], name + 'should have all the values')
        })
      }
    })
  })

  await testPromiseClassCastMethod({
    t,
    count: 1,
    testFunc: function ({ plan, Promise, name, value }) {
      return Promise.join(value, name).then(function (values) {
        plan.deepEqual(values, [value, name], 'should have expected values')
      })
    }
  })
})

test('Promise.map', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.map([name], function (v) {
        return v.toUpperCase()
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.map([Promise.resolve('1'), Promise.resolve('2')], function (item) {
          return Promise.resolve(name + item)
        }).then(function (result) {
          plan.deepEqual(result, [name + '1', name + '2'], 'should not change the result')
        })
      }
    })
  })
})

test('Promise.mapSeries', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.mapSeries([name], function (v) {
        return v.toUpperCase()
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.mapSeries([Promise.resolve('1'), Promise.resolve('2')], function (item) {
          return Promise.resolve(name + item)
        }).then(function (result) {
          plan.deepEqual(result, [name + '1', name + '2'], 'should not change the result')
        })
      }
    })
  })
})

test('Promise.method', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.method(function () {
        return name
      })()
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, name }) {
        const fn = Promise.method(function () {
          throw new Error('Promise.method test error')
        })

        return fn()
          .then(
            function () {
              plan.ok(0, name + 'should not go into resolve after throwing')
            },
            function (err) {
              plan.ok(err, name + 'should have error')
              plan.equal(err.message, 'Promise.method test error', name + 'should be correct error')
            }
          )
          .then(function () {
            const foo = { what: 'Promise.method test object' }
            const fn2 = Promise.method(function () {
              return foo
            })

            return fn2().then(function (obj) {
              plan.equal(obj, foo, name + 'should also work on success')
            })
          })
      }
    })
  })
})

test('Promise.noConflict', function (t) {
  helper.loadTestAgent(t)
  const Promise = require('bluebird')
  const Promise2 = Promise.noConflict()

  assert.ok(Promise2.resolve[symbols.original], 'should have wrapped class methods')
  assert.ok(Promise2.prototype.then[symbols.original], 'should have wrapped instance methods')
})

test('Promise.promisify', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.promisify(function (cb) {
        cb(null, name)
      })()
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, name }) {
        const fn = Promise.promisify(function (cb) {
          cb(new Error('Promise.promisify test error'))
        })

        // Test error handling.
        return fn()
          .then(
            function () {
              plan.ok(0, name + 'should not go into resolve after throwing')
            },
            function (err) {
              plan.ok(err, name + 'should have error')
              plan.equal(
                err.message,
                'Promise.promisify test error',
                name + 'should be correct error'
              )
            }
          )
          .then(function () {
            // Test success handling.
            const foo = { what: 'Promise.promisify test object' }
            const fn2 = Promise.promisify(function (cb) {
              cb(null, foo)
            })

            return fn2().then(function (obj) {
              plan.equal(obj, foo, name + 'should also work on success')
            })
          })
          .then(() => {
            // Test property copying.
            const unwrapped = (cb) => cb()
            const property = { name }
            unwrapped.property = property

            const wrapped = Promise.promisify(unwrapped)
            plan.equal(wrapped.property, property, 'should have copied properties')
          })
      }
    })
  })
})

test('Promise.props', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.props({ name })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.props({
          first: Promise.resolve(name + '1'),
          second: Promise.resolve(name + '2')
        }).then(function (result) {
          plan.deepEqual(
            result,
            { first: name + '1', second: name + '2' },
            'should not change results'
          )
        })
      }
    })
  })
})

test('Promise.race', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.race([name])
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.race([
          Promise.resolve(name + 'resolved'),
          Promise.reject(name + 'rejection!'),
          Promise.delay(15, name + 'delayed')
        ]).then(function (result) {
          plan.equal(result, name + 'resolved', 'should not change the result')
        })
      }
    })
  })
})

test('Promise.reduce', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.reduce([name, name], function (a, b) {
        return a + b
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.reduce(
          [Promise.resolve('1'), Promise.resolve('2'), Promise.resolve('3'), Promise.resolve('4')],
          function (a, b) {
            return Promise.resolve(name + a + b)
          }
        ).then(function (result) {
          plan.equal(result, name + name + name + '1234', 'should not change the result')
        })
      }
    })
  })
})

test('Promise.some', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.some([name], 1)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.some(
          [
            Promise.resolve(name + 'resolved'),
            Promise.reject(name + 'rejection!'),
            Promise.delay(100, name + 'delayed more'),
            Promise.delay(5, name + 'delayed')
          ],
          2
        ).then(function (result) {
          plan.deepEqual(
            result,
            [name + 'resolved', name + 'delayed'],
            'should not change the result'
          )
        })
      }
    })
  })
})

test('Promise#all', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([Promise.resolve(name + '1'), Promise.resolve(name + '2')]).all()
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [Promise.resolve(name + '1'), Promise.resolve(name + '2')]
          })
          .all()
          .then(function (result) {
            plan.deepEqual(result, [name + '1', name + '2'], name + 'should not change result')
          })
      }
    })
  })
})

test('Promise#any', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.reject(name + 'rejection!'),
        Promise.resolve(name + 'resolved'),
        Promise.delay(15, name + 'delayed')
      ]).any()
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [
              Promise.reject(name + 'rejection!'),
              Promise.resolve(name + 'resolved'),
              Promise.delay(15, name + 'delayed')
            ]
          })
          .any()
          .then(function (result) {
            plan.equal(result, name + 'resolved', 'should not change the result')
          })
      }
    })
  })
})

test('Promise#bind', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).bind({ name: name })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, promise, name }) {
        const foo = { what: 'test object' }
        const ctx2 = { what: 'a different test object' }
        const err = new Error('oh dear')
        return promise
          .bind(foo)
          .then(function (res) {
            plan.equal(this, foo, name + 'should have correct this value')
            plan.deepEqual(res, [1, 2, 3, name], name + 'parameters should be correct')

            return Promise.reject(err)
          })
          .bind(ctx2, name)
          .catch(function (reason) {
            plan.equal(this, ctx2, 'should have expected `this` value')
            plan.equal(reason, err, 'should not change rejection reason')
          })
      }
    })
  })

  await testPromiseInstanceCastMethod({
    t,
    count: 2,
    testFunc: function ({ plan, promise, name, value }) {
      return promise.bind(value).then(function (val) {
        plan.equal(this, value, 'should have correct context')
        plan.equal(val, name, 'should have expected value')
      })
    }
  })
})

test('Promise#call', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve({
        foo: function () {
          return Promise.resolve(name)
        }
      }).call('foo')
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, promise, name }) {
        const foo = {
          test: function () {
            plan.equal(this, foo, name + 'should have correct this value')
            plan.ok(1, name + 'should call the test method of foo')
            return 'foobar'
          }
        }
        return promise
          .then(function () {
            return foo
          })
          .call('test')
          .then(function (res) {
            plan.deepEqual(res, 'foobar', name + 'parameters should be correct')
          })
      }
    })
  })
})

test('Promise#catchReturn', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.reject(new Error()).catchReturn(name)
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        const foo = { what: 'catchReturn test object' }
        return promise
          .throw(new Error('catchReturn test error'))
          .catchReturn(foo)
          .then(function (res) {
            plan.equal(res, foo, name + 'should pass throught the correct object')
          })
      }
    })
  })

  await testPromiseInstanceCastMethod({
    t,
    count: 1,
    testFunc: function ({ plan, promise, value }) {
      return promise
        .then(function () {
          throw new Error('woops')
        })
        .catchReturn(value)
        .then(function (val) {
          plan.equal(val, value, 'should have expected value')
        })
    }
  })
})

test('Promise#catchThrow', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.reject(new Error()).catchThrow(new Error(name))
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        const foo = { what: 'catchThrow test object' }
        return promise
          .throw(new Error('catchThrow test error'))
          .catchThrow(foo)
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
      return promise
        .then(function () {
          throw new Error('woops')
        })
        .catchThrow(value)
        .catch(function (err) {
          plan.equal(err, value, 'should have expected error')
        })
    }
  })
})

test('Promise#delay', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).delay(10)
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, promise, name }) {
        const DELAY = 500
        const MARGIN = 100
        const start = Date.now()
        return promise
          .return(name)
          .delay(DELAY)
          .then(function (result) {
            const duration = Date.now() - start
            plan.ok(duration < DELAY + MARGIN, 'should not take more than expected time')
            plan.ok(duration > DELAY - MARGIN, 'should not take less than expected time')
            plan.equal(result, name, 'should pass through resolve value')
          })
      }
    })
  })
})

test('Promise#each', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.delay(Math.random() * 10, name + '1'),
        Promise.delay(Math.random() * 10, name + '2'),
        Promise.delay(Math.random() * 10, name + '3'),
        Promise.delay(Math.random() * 10, name + '4')
      ]).each(function (value, i) {
        return Promise.delay(i, value)
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 5,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [
              Promise.delay(Math.random() * 10, name + '1'),
              Promise.delay(Math.random() * 10, name + '2'),
              Promise.delay(Math.random() * 10, name + '3'),
              Promise.delay(Math.random() * 10, name + '4')
            ]
          })
          .each(function (value, i) {
            plan.equal(value, name + (i + 1), 'should not change input to iterator')
          })
          .then(function (result) {
            plan.deepEqual(result, [name + '1', name + '2', name + '3', name + '4'])
          })
      }
    })
  })
})

test('Promise#error', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  function OperationalError(message) {
    this.message = message
    this.isOperational = true
  }

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.reject(new OperationalError(name)).error(function (err) {
        return err
      })
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 2,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .error(function (err) {
            plan.ok(!err)
          })
          .then(function () {
            throw new OperationalError('Promise#error test error')
          })
          .error(function (err) {
            plan.ok(err, name + 'should pass error into rejection handler')
            plan.equal(err.message, 'Promise#error test error', name + 'should be correct error')
          })
      }
    })
  })
})

test('Promise#filter', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.resolve(name + '1'),
        Promise.resolve(name + '2'),
        Promise.resolve(name + '3'),
        Promise.resolve(name + '4')
      ]).filter(function (value, i) {
        return Promise.delay(i, /[24]$/.test(value))
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [
              Promise.resolve(name + '1'),
              Promise.resolve(name + '2'),
              Promise.resolve(name + '3'),
              Promise.resolve(name + '4')
            ]
          })
          .filter(function (value) {
            return Promise.resolve(/[24]$/.test(value))
          })
          .then(function (result) {
            plan.deepEqual(result, [name + '2', name + '4'], 'should not change the result')
          })
      }
    })
  })
})

test('Promise#get', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve({ name: Promise.resolve(name) }).get('name')
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise.get('length').then(function (res) {
          plan.equal(res, 4, name + 'should get the property specified')
        })
      }
    })
  })
})

test('Promise#map', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([Promise.resolve('1'), Promise.resolve('2')]).map(function (item) {
        return Promise.resolve(name + item)
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [Promise.resolve('1'), Promise.resolve('2')]
          })
          .map(function (item) {
            return Promise.resolve(name + item)
          })
          .then(function (result) {
            plan.deepEqual(result, [name + '1', name + '2'], 'should not change the result')
          })
      }
    })
  })
})

test('Promise#mapSeries', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([Promise.resolve('1'), Promise.resolve('2')]).mapSeries(function (
        item
      ) {
        return Promise.resolve(name + item)
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [Promise.resolve('1'), Promise.resolve('2')]
          })
          .mapSeries(function (item) {
            return Promise.resolve(name + item)
          })
          .then(function (result) {
            plan.deepEqual(result, [name + '1', name + '2'], 'should not change the result')
          })
      }
    })
  })
})

test('Promise#props', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve({
        first: Promise.delay(5, name + '1'),
        second: Promise.delay(5, name + '2')
      }).props()
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return {
              first: Promise.resolve(name + '1'),
              second: Promise.resolve(name + '2')
            }
          })
          .props()
          .then(function (result) {
            plan.deepEqual(
              result,
              { first: name + '1', second: name + '2' },
              'should not change results'
            )
          })
      }
    })
  })
})

test('Promise#race', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.resolve(name + 'resolved'),
        Promise.delay(15, name + 'delayed')
      ]).race()
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [Promise.resolve(name + 'resolved'), Promise.delay(15, name + 'delayed')]
          })
          .race()
          .then(function (result) {
            plan.equal(result, name + 'resolved', 'should not change the result')
          })
      }
    })
  })
})

test('Promise#reduce', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.resolve('1'),
        Promise.resolve('2'),
        Promise.resolve('3'),
        Promise.resolve('4')
      ]).reduce(function (a, b) {
        return Promise.resolve(name + a + b)
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [
              Promise.resolve('1'),
              Promise.resolve('2'),
              Promise.resolve('3'),
              Promise.resolve('4')
            ]
          })
          .reduce(function (a, b) {
            return Promise.resolve(name + a + b)
          })
          .then(function (result) {
            plan.equal(result, name + name + name + '1234', 'should not change the result')
          })
      }
    })
  })
})

test('Promise#reflect', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).reflect()
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 12,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .reflect()
          .then(function (inspection) {
            // Inspection of a resolved promise.
            plan.ok(!inspection.isPending(), name + 'should not be pending')
            plan.ok(!inspection.isRejected(), name + 'should not be rejected')
            plan.ok(inspection.isFulfilled(), name + 'should be fulfilled')
            plan.ok(!inspection.isCancelled(), name + 'should not be cancelled')
            plan.throws(function () {
              inspection.reason()
            }, name + 'should throw when accessing reason')
            plan.ok(inspection.value(), name + 'should have the value')
          })
          .throw(new Error(name + 'test error'))
          .reflect()
          .then(function (inspection) {
            plan.ok(!inspection.isPending(), name + 'should not be pending')
            plan.ok(inspection.isRejected(), name + 'should be rejected')
            plan.ok(!inspection.isFulfilled(), name + 'should not be fulfilled')
            plan.ok(!inspection.isCancelled(), name + 'should not be cancelled')
            plan.ok(inspection.reason(), name + 'should have the reason for rejection')
            plan.throws(function () {
              inspection.value()
            }, 'should throw accessing the value')
          })
      }
    })
  })
})

test('Promise#return', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve().return(name)
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        const foo = { what: 'return test object' }
        return promise.return(foo).then(function (res) {
          plan.equal(res, foo, name + 'should pass throught the correct object')
        })
      }
    })
  })

  await testPromiseInstanceCastMethod({
    t,
    count: 1,
    testFunc: function ({ plan, promise, value }) {
      return promise.return(value).then(function (val) {
        plan.equal(val, value, 'should have expected value')
      })
    }
  })
})

test('Promise#some', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.resolve(name + 'resolved'),
        Promise.reject(name + 'rejection!'),
        Promise.delay(100, name + 'delayed more'),
        Promise.delay(5, name + 'delayed')
      ]).some(2)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [
              Promise.resolve(name + 'resolved'),
              Promise.reject(name + 'rejection!'),
              Promise.delay(100, name + 'delayed more'),
              Promise.delay(5, name + 'delayed')
            ]
          })
          .some(2)
          .then(function (result) {
            plan.deepEqual(
              result,
              [name + 'resolved', name + 'delayed'],
              'should not change the result'
            )
          })
      }
    })
  })
})

test('Promise#spread', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([name, 1, 2, 3, 4]).spread(function () {})
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise.spread(function (a, b, c, d) {
          plan.deepEqual([a, b, c, d], [1, 2, 3, name], name + 'parameters should be correct')
        })
      }
    })
  })
})

test('Promise#tap', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).tap(function () {})
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .tap(function (res) {
            plan.deepEqual(res, [1, 2, 3, name], name + 'should pass values into tap handler')
          })
          .then(function (res) {
            plan.deepEqual(res, [1, 2, 3, name], name + 'should pass values beyond tap handler')
            throw new Error('Promise#tap test error')
          })
          .tap(function () {
            plan.ok(0, name + 'should not call tap after rejected promises')
          })
          .catch(function (err) {
            plan.ok(err, name + 'should pass error beyond tap handler')
            plan.equal(
              err && err.message,
              'Promise#tap test error',
              name + 'should be correct error'
            )
          })
      }
    })
  })
})

test('Promise#tapCatch', { skip: semver.lt(pkgVersion, '3.5.0') }, async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.reject(new Error(name)).tapCatch(function () {})
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .throw(new Error(name))
          .tapCatch(function (err) {
            plan.equal(err && err.message, name, name + 'should pass values into tapCatch handler')
          })
          .then(function () {
            plan.ok(0, 'should not enter following resolve handler')
          })
          .catch(function (err) {
            plan.equal(
              err && err.message,
              name,
              name + 'should pass values beyond tapCatch handler'
            )
            return name + 'resolve test'
          })
          .tapCatch(function () {
            plan.ok(0, name + 'should not call tapCatch after resolved promises')
          })
          .then(function (value) {
            plan.equal(value, name + 'resolve test', name + 'should pass error beyond tap handler')
          })
      }
    })
  })
})

test('Promise#then', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve().then(function () {
        return name
      })
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function (res) {
            plan.deepEqual(res, [1, 2, 3, name], name + 'should have the correct result value')
            throw new Error('Promise#then test error')
          })
          .then(
            function () {
              plan.ok(0, name + 'should not go into resolve handler from rejected promise')
            },
            function (err) {
              plan.ok(err, name + 'should pass error into thenned rejection handler')
              plan.equal(err.message, 'Promise#then test error', name + 'should be correct error')
            }
          )
      }
    })
  })
})

test('Promise#thenReturn', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve().thenReturn(name)
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .thenReturn(name)
          .then(function (res) {
            plan.deepEqual(res, name, name + 'should have the correct result value')
            throw new Error('Promise#then test error')
          })
          .thenReturn('oops!')
          .then(
            function () {
              plan.ok(0, name + 'should not go into resolve handler from rejected promise')
            },
            function (err) {
              plan.ok(err, name + 'should pass error into thenned rejection handler')
              plan.equal(err.message, 'Promise#then test error', name + 'should be correct error')
            }
          )
      }
    })
  })

  await testPromiseInstanceCastMethod({
    t,
    count: 1,
    testFunc: function ({ plan, promise, value }) {
      return promise.thenReturn(value).then(function (val) {
        plan.equal(val, value, 'should have expected value')
      })
    }
  })
})

test('Promise#timeout', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).timeout(10)
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, promise, name }) {
        let start = null
        return promise
          .timeout(1000)
          .then(
            function (res) {
              plan.deepEqual(res, [1, 2, 3, name], name + 'should pass values into tap handler')
              start = Date.now()
            },
            function (err) {
              plan.ok(!err)
            }
          )
          .delay(1000, 'never see me')
          .timeout(500, name + 'timed out')
          .then(
            function () {
              plan.ok(0, name + 'should have timed out long delay')
            },
            function (err) {
              const duration = Date.now() - start
              plan.ok(duration < 600, name + 'should not timeout slower than expected')
              plan.ok(duration > 400, name + 'should not timeout faster than expected')
              plan.equal(err.message, name + 'timed out', name + 'should have expected error')
            }
          )
      }
    })
  })
})

test('bluebird static and instance methods check', function (t) {
  helper.loadTestAgent(t)
  const Promise = require('bluebird')

  areMethodsWrapped(Promise)
  areMethodsWrapped(Promise.prototype)
})
