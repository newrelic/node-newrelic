/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const tspl = require('@matteo.collina/tspl')

const { removeModules } = require('../../lib/cache-buster')
const tempOverrideUncaught = require('../../lib/temp-override-uncaught')
const helper = require('../../lib/agent_helper')
const { assertPackageMetrics } = require('../../lib/custom-assertions')

function setupTest(t, enableSegments) {
  t.nr.agent = helper.instrumentMockedAgent({
    feature_flag: { promise_segments: enableSegments }
  })
  t.nr.when = require('when')

  return { agent: t.nr.agent, when: t.nr.when }
}

test.beforeEach((ctx) => {
  ctx.nr = {}
})

test.afterEach((ctx) => {
  if (ctx.nr.agent) {
    helper.unloadAgent(ctx.nr.agent)
  }
  removeModules(['when'])
})

test('no transaction', (t, end) => {
  const { when } = setupTest(t)

  when
    .resolve(0)
    .then(function step1() {
      return 1
    })
    .then(function step2() {
      return 2
    })
    .then(function finalHandler(res) {
      assert.equal(res, 2, 'should be the correct result')
    })
    .finally(function finallyHandler() {
      end()
    })

  const { agent } = t.nr
  const { version } = require('when/package.json')
  assertPackageMetrics({ agent, pkg: 'when', version })
})

test('new Promise() throw', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { when } = setupTest(t)
  const { Promise } = when

  try {
    new Promise(function () {
      throw new Error('test error')
    }).then(
      function resolved() {
        plan.fail('Error should have been caught.')
      },
      function rejected(err) {
        plan.ok(err, 'Error should go to the reject handler')
        plan.equal(err.message, 'test error', 'Error should be as expected')
      }
    )
  } catch {
    plan.fail('Error should have passed to `reject`.')
  }

  await plan.completed
})

test('new Promise() resolve then throw', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { when } = setupTest(t)
  const { Promise } = when

  try {
    new Promise(function (resolve) {
      resolve('foo')
      throw new Error('test error')
    }).then(
      function resolved(res) {
        plan.equal(res, 'foo', 'promise should be resolved.')
      },
      function rejected() {
        plan.fail('Error should have been swallowed by promise.')
      }
    )
  } catch {
    plan.fail('Error should have passed to `reject`.')
  }

  await plan.completed
})

test('when()', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, when } = setupTest(t)
  const testFunc = (name) => when(name).then(function resolved(value) {
    plan.equal(value, name, `${name} should pass the value`)

    return when(when.reject(Error(`${name} error message`)))
      .then(() => plan.fail(`${name} should not call resolve handler after throwing`))
      .catch((error) => plan.equal(error.message, `${name} error message`, `${name} should have correct error`))
  })

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('when.defer', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, when } = setupTest(t)
  const testFunc = (name) => {
    const defer = when.defer()
    process.nextTick(() => defer.resolve(`${name} resolve value`))

    return defer.promise.then((value) => {
      plan.equal(value, `${name} resolve value`, `${name} should have correct value`)

      const defer2 = when.defer()
      defer2.reject(Error(`${name} error message`))
      return defer2.promise
        .then(() => plan.fail(`${name} should not call resolve handler after throwing`))
        .catch((error) => plan.equal(error.message, `${name} error message`, `${name} should have correct error`))
    })
  }

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('when debug API', async (t) => {
  await t.test('should not break onFatalRejection', async (t) => {
    const plan = tspl(t, { plan: 1 })
    const { when } = setupTest(t)
    tempOverrideUncaught({ t, handler() {}, type: tempOverrideUncaught.REJECTION })

    const error = { val: 'test' }
    when.Promise.onFatalRejection = (e) => {
      plan.equal(e.value, error)
    }

    const p = when.reject(error)
    p.done()

    await plan.completed
  })

  await t.test('should not break onPotentiallyUnhandledRejectionHandled', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { when } = setupTest(t)
    tempOverrideUncaught({ t, handler() {}, type: tempOverrideUncaught.REJECTION })

    let p = null
    const error = { val: 'test' }
    when.Promise.onPotentiallyUnhandledRejectionHandled = (e) => plan.equal(e.value, error, 'should have passed error through')
    when.Promise.onPotentiallyUnhandledRejection = (e) => {
      plan.equal(e.value, error, 'should pass error through')
      // Trigger the `onPotentiallyUnhandledRejectionHandled` callback.
      p.catch(() => {})
    }

    when.Promise.reject(error)
    p = when.reject(error)

    await plan.completed
  })
})

test('when.iterate', async (t) => {
  const plan = tspl(t, { plan: 130 })
  const { agent, when } = setupTest(t)
  const COUNT = 10
  const testFunc = (name) => {
    const tx = agent.getTransaction()
    let incrementorCount = 0
    let predicateCount = 0
    let bodyCount = 0

    return when.iterate(iterator, predicate, handler, 0)

    function iterator(seed) {
      plan.equal(agent.getTransaction(), tx, `${name} iterator has correct transaction state`)
      plan.equal(incrementorCount++, seed++, `${name} should iterate as expected`)
      return seed
    }

    function predicate(iteration) {
      plan.equal(agent.getTransaction(), tx, `${name} predicate has correct transaction state`)
      plan.equal(predicateCount++, iteration, `${name} should execute predicate each time`)
      return iteration >= COUNT
    }

    function handler(value) {
      plan.equal(agent.getTransaction(), tx, `${name} body has correct transaction state`)
      plan.equal(bodyCount++, value, `${name} should execute each time`)
    }
  }

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('when.join', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, when } = setupTest(t)
  const testFunc = (name) => when.join(2, when.resolve(name)).then((value) => {
    plan.deepStrictEqual(value, [2, name], `${name} should resolve with correct value`)
    return when
      .join(2, when.reject(Error(`${name} error message`)))
      .then(() => plan.fail(`${name} should not call resolve handler after throwing`))
      .catch((error) => plan.equal(error.message, `${name} error message`, `${name} should have correct error`))
  })

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('when.lift', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, when } = setupTest(t)
  const testFunc = (name) => {
    const func = when.lift((value) => {
      if (value instanceof Error) {
        throw value
      }
      return value
    })

    return func(`${name} return value`).then((value) => {
      plan.equal(value, `${name} return value`, `${name} should pass return value`)
      return func(Error(`${name} error message`))
        .then(() => plan.fail(`${name} should not call resolve handler after throwing`))
        .catch((error) => plan.equal(error.message, `${name} error message`, `${name} should have correct error`))
    })
  }

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('when.promise', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, when } = setupTest(t)
  const testFunc = (name) => when
    .promise((resolve) => resolve(`${name} resolve value`))
    .then((value) => {
      plan.equal(value, `${name} resolve value`, `${name} should pass the value`)
      return when.promise((_, reject) => reject(`${name} reject value`))
    })
    .then(
      () => plan.fail(`${name} should not call resolve handler after rejection`),
      (error) => plan.equal(error, `${name} reject value`, `${name} should pass the value`)
    )

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('when.resolve', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const testFunc = (name) => when
    .resolve(`${name} resolve value`)
    .then((value) => plan.equal(value, `${name} resolve value`, `${name} should pass the value`))

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('when.reject', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const testFunc = (name) => when
    .reject(`${name} reject value`)
    .then(() => plan.fail(`${name} should not resolve after a rejection`))
    .catch((error) => plan.equal(error, `${name} reject value`, `${name} should reject with the error`))

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

for (const method of ['try', 'attempt']) {
  test(`when.${method}`, async (t) => {
    const plan = tspl(t, { plan: 4 })
    const { agent, when } = setupTest(t)
    const testFunc = (name) => {
      return when[method](handler, `${name}${method}`).then((value) => {
        plan.equal(value, `${name} return value`, `${name} should pass result through`)
        return when[method](() => {
          throw Error(`${name} error message`)
        })
          .then(() => plan.fail(`${name} should not call resolve handler after throwing`))
          .catch((error) => plan.equal(error.message, `${name} error message`, `${name} should have correct error`))
      })

      function handler(value) {
        plan.equal(value, `${name}${method}`, `${name} should receive values`)
        return `${name} return value`
      }
    }

    await testThrowOutsideTransaction({ plan, agent, testFunc })
    await testInsideTransaction({ plan, agent, testFunc })
    await plan.completed
  })
}

test('Promise.resolve', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const testFunc = (name) => when.Promise.resolve(`${name} resolve value`).then((value) => plan.equal(value, `${name} resolve value`, `${name} should pass the value`))

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise.reject', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const testFunc = (name) => when.Promise.reject(`${name} reject value`)
    .then(() => plan.fail(`${name} should not resolve after a rejection`))
    .catch((error) => plan.equal(error, `${name} reject value`, `${name} should reject with the error`))

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#done', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => new Promise((resolve, reject) => {
    const ret = Promise.resolve(`${name} resolve value`).done(resolve, reject)
    plan.equal(ret, undefined, `${name} should not return a promise from #done`)
  })
    .then((value) => plan.equal(value, `${name} resolve value`, `${name} should resolve correctly`))
    .then(
      () => new Promise((resolve, reject) => Promise.reject(Error(`${name} error message`)).done(resolve, reject))
    )
    .then(() => plan.fail(`${name} should not resolve after rejection`))
    .catch((error) => plan.equal(error.message, `${name} error message`, `${name} should have correct error`))

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#then', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => Promise.resolve([1, 2, 3, name])
    .then((value) => {
      plan.deepStrictEqual(value, [1, 2, 3, name], `${name} should have the correct result value`)
      throw Error('Promise#then test error')
    })
    .then(
      () => plan.fail(`${name} should not go into resolve handler from rejected promise`),
      (error) => {
        plan.ok(error, `${name} should pass error into then-ed rejection handler`)
        plan.equal(error.message, 'Promise#then test error', `${name} should be correct error`)
      }
    )

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#catch', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => Promise.resolve([1, 2, 3, name])
    .catch(() => plan.fail(`${name} should not go into catch from a resolved promise`))
    .then(() => {
      throw Error('Promise#catch test error')
    })
    .catch((error) => {
      plan.ok(error, `${name} should pass error into then-ed rejection handler`)
      plan.equal(error.message, 'Promise#catch test error', `${name} should be correct error`)
    })

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#otherwise', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => Promise.resolve([1, 2, 3, name])
    .otherwise(() => plan.fail(`${name} should not go into otherwise from a resolved promise`))
    .then(() => {
      throw Error('Promise#otherwise test error')
    })
    .otherwise((error) => {
      plan.ok(error, `${name} should pass error into then-ed rejection handler`)
      plan.equal(error.message, 'Promise#otherwise test error', `${name} should be correct error`)
    })

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#finally', async (t) => {
  const plan = tspl(t, { plan: 18 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => Promise.resolve([1, 2, 3, name])
    .finally((...args) => {
      plan.equal(args.length, 0, `${name} should not receive any parameters`)
    })
    .then((value) => {
      plan.deepStrictEqual(
        value,
        [1, 2, 3, name],
          `${name} should pass values beyond finally handler`
      )
      throw Error('Promise#finally test error')
    })
    .finally((...args) => {
      plan.equal(args.length, 0, `${name} should not receive any parameters`)
      plan.ok(true, `${name} should go into finally handler from rejected promise`)
    })
    .catch((error) => {
      plan.ok(error, `${name} should pass error beyond finally handler`)
      plan.equal(error.message, 'Promise#finally test error', `${name} should be correct error`)
    })

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#ensure', async (t) => {
  const plan = tspl(t, { plan: 18 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => Promise.resolve([1, 2, 3, name])
    .ensure((...args) => {
      plan.equal(args.length, 0, `${name} should not receive any parameters`)
    })
    .then((value) => {
      plan.deepStrictEqual(
        value,
        [1, 2, 3, name],
          `${name} should pass values beyond ensure handler`
      )
      throw Error('Promise#ensure test error')
    })
    .ensure((...args) => {
      plan.equal(args.length, 0, `${name} should not receive any parameters`)
      plan.ok(true, `${name} should go into ensure handler from rejected promise`)
    })
    .catch((error) => {
      plan.ok(error, `${name} should pass error beyond ensure handler`)
      plan.equal(error.message, 'Promise#ensure test error', `${name} should be correct error`)
    })

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#tap', async (t) => {
  const plan = tspl(t, { plan: 14 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => Promise.resolve([1, 2, 3, name])
    .tap((value) => {
      plan.deepStrictEqual(value, [1, 2, 3, name], `${name} should pass values into tap handler`)
    })
    .then((value) => {
      plan.deepStrictEqual(
        value,
        [1, 2, 3, name],
          `${name} should pass values beyond tap handler`
      )
      throw Error('Promise#tap test error')
    })
    .tap(() => plan.fail(`${name} should not call tap after rejected promises`))
    .catch((error) => {
      plan.ok(error, `${name} should pass error beyond tap handler`)
      plan.equal(error.message, 'Promise#tap test error', `${name} should be correct error`)
    })

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#spread', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => Promise.resolve([1, 2, 3, name]).spread((a, b, c, d) => plan.deepStrictEqual([a, b, c, d], [1, 2, 3, name], `${name} parameters should be correct`))

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#fold', async (t) => {
  const plan = tspl(t, { plan: 12 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => {
    const p = Promise.resolve([1, 2, 3, name])
    return p
      .fold(
        (a, b) => {
          plan.equal(a, name, `${name} first parameter should be second promise`)
          plan.deepStrictEqual(
            b,
            [1, 2, 3, name],
            `${name} second parameter should be first promise`
          )
          return [a, b]
        },
        p.then(() => name)
      )
      .then((value) => plan.deepStrictEqual(
        value,
        [name, [1, 2, 3, name]],
          `${name} should have correct parameters`
      ))
  }

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#yield', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => Promise.resolve([1, 2, 3, name])
    .yield(`${name} yield value`)
    .then((value) => plan.equal(value, `${name} yield value`, `${name} should have correct value`))

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

for (const method of ['else', 'orElse']) {
  test(`Promise#${method}`, async (t) => {
    const plan = tspl(t, { plan: 10 })
    const { agent, when } = setupTest(t)
    const { Promise } = when
    const testFunc = (name) => {
      const p = Promise.resolve([1, 2, 3, name])
      return p[method](Error(`${name} skipped else message`))
        .then(
          (value) => plan.deepStrictEqual(
            value,
            [1, 2, 3, name],
              `${name} should pass value through the else`
          ),
          () => plan.fail(`${name} should not have rejected first promise`)
        )
        .then(() => {
          throw Error(`${name} original error`)
        })[method](`${name} elsed value`).then((value) => plan.deepStrictEqual(
          value,
            `${name} elsed value`,
            `${name} should resolve with else value`
        ))
    }

    await testThrowOutsideTransaction({ plan, agent, testFunc })
    await testInsideTransaction({ plan, agent, testFunc })
    await plan.completed
  })
}

test('Promise#delay', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => {
    const start = Date.now()
    return Promise.resolve([1, 2, 3, name]).delay(100).then((value) => {
      const end = Date.now()
      plan.deepStrictEqual(value, [1, 2, 3, name], `${name} should resolve with original promise`)
      plan.ok(end - start >= 100, `${name} should delay at least the specified duration`)
    })
  }

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#timeout', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => {
    const start = Date.now()
    return Promise.resolve([1, 2, 3, name])
      .delay(100)
      .timeout(50, Error(`${name} timeout message`))
      .then(() => plan.fail(`${name} should not have resolved`))
      .catch((error) => {
        const end = Date.now()
        plan.equal(error.message, `${name} timeout message`, `${name} should have correct message`)
        const time = end - start
        plan.ok(time > 48, `${name} should wait close to the correct time, actual wait ${time}`)
      })
  }

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('Promise#with', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, when } = setupTest(t)
  const { Promise } = when
  const testFunc = (name) => {
    const obj = {
      [Symbol.toStringTag]: 'test-obj'
    }
    return Promise.resolve([1, 2, 3, name]).with(obj).then(function (value) {
      plan.deepStrictEqual(value, [1, 2, 3, name], `${name} should resolve with original promise`)
      plan.strictEqual(this === obj, true, `${name} should have correct context`)
    })
  }

  await testThrowOutsideTransaction({ plan, agent, testFunc })
  await testInsideTransaction({ plan, agent, testFunc })
  await plan.completed
})

test('all', async (t) => {
  await t.test('on library', (t, end) => {
    const { agent, when } = setupTest(t, false)
    const { Promise } = when
    const p1 = Promise.resolve(1)
    const p2 = Promise.resolve(2)

    helper.runInTransaction(agent, (tx) => {
      when.all([p1, p2]).then(() => {
        assert.equal(agent.getTransaction(), tx, 'has the right transaction')
        end()
      })
    })
  })

  await t.test('on Promise', (t, end) => {
    const { agent, when } = setupTest(t, false)
    const { Promise } = when
    const p1 = Promise.resolve(1)
    const p2 = Promise.resolve(2)

    helper.runInTransaction(agent, (tx) => {
      Promise.all([p1, p2]).then(() => {
        assert.equal(agent.getTransaction(), tx, 'has the right transaction')
        end()
      })
    })
  })
})

test('any', async (t) => {
  await t.test('on library', (t, end) => {
    const { agent, when } = setupTest(t, false)

    helper.runInTransaction(agent, (tx) => {
      when.any([when.resolve(1), when.resolve(2)]).then((value) => {
        assert.equal(value, 1)
        assert.equal(agent.getTransaction(), tx, 'has the right transaction')
        end()
      })
    })
  })

  await t.test('on Promise', (t, end) => {
    const { agent, when } = setupTest(t, false)
    const { Promise } = when

    helper.runInTransaction(agent, (tx) => {
      Promise.any([when.resolve(1), when.resolve(2)]).then((value) => {
        assert.equal(value, 1)
        assert.equal(agent.getTransaction(), tx, 'has the right transaction')
        end()
      })
    })
  })
})

test('some', async (t) => {
  await t.test('on library', (t, end) => {
    const { agent, when } = setupTest(t, false)

    helper.runInTransaction(agent, (tx) => {
      when.some([when.resolve(1), when.resolve(2), when.resolve(3)], 2).then((value) => {
        assert.equal(value.length, 2)
        assert.equal(value[0], 1)
        assert.equal(value[1], 2)
        assert.equal(agent.getTransaction(), tx, 'has the right transaction')
        end()
      })
    })
  })

  await t.test('on Promise', (t, end) => {
    const { agent, when } = setupTest(t, false)
    const { Promise } = when

    helper.runInTransaction(agent, (tx) => {
      Promise.some([when.resolve(1), when.resolve(2), when.resolve(3)], 2).then((value) => {
        assert.equal(value.length, 2)
        assert.equal(value[0], 1)
        assert.equal(value[1], 2)
        assert.equal(agent.getTransaction(), tx, 'has the right transaction')
        end()
      })
    })
  })
})

test('map', async (t) => {
  await t.test('on library', (t, end) => {
    const { agent, when } = setupTest(t, false)

    helper.runInTransaction(agent, (tx) => {
      when
        .map([1, 2], (item) => when.resolve(item))
        .then((value) => {
          assert.equal(value.length, 2)
          assert.equal(value[0], 1)
          assert.equal(value[1], 2)
          assert.equal(agent.getTransaction(), tx, 'has the right transaction')
          end()
        })
    })
  })

  await t.test('on Promise', (t, end) => {
    const { agent, when } = setupTest(t, false)
    const { Promise } = when

    helper.runInTransaction(agent, (tx) => {
      Promise.map([1, 2], (item) => when.resolve(item)).then((value) => {
        assert.equal(value.length, 2)
        assert.equal(value[0], 1)
        assert.equal(value[1], 2)
        assert.equal(agent.getTransaction(), tx, 'has the right transaction')
        end()
      })
    })
  })
})

test('reduce', async (t) => {
  await t.test('on library', (t, end) => {
    const { agent, when } = setupTest(t, false)

    helper.runInTransaction(agent, (tx) => {
      when
        .reduce(
          [1, 2],
          (total, item) => when.resolve(item).then((r) => total + r),
          0
        )
        .then((total) => {
          assert.equal(total, 3)
          assert.equal(agent.getTransaction(), tx, 'has the right transaction')
          end()
        })
    })
  })

  await t.test('on Promise', (t, end) => {
    const { agent, when } = setupTest(t, false)
    const { Promise } = when

    helper.runInTransaction(agent, (tx) => {
      Promise.reduce(
        [1, 2],
        (total, item) => when.resolve(item).then((r) => total + r),
        0
      ).then((total) => {
        assert.equal(total, 3)
        assert.equal(agent.getTransaction(), tx, 'has the right transaction')
        end()
      })
    })
  })
})

test('filter', async (t) => {
  await t.test('on library', (t, end) => {
    const { agent, when } = setupTest(t, false)

    helper.runInTransaction(agent, (tx) => {
      when
        .filter([1, 2, 3, 4], (v) => v % 2)
        .then((value) => {
          assert.equal(value.length, 2)
          assert.equal(agent.getTransaction(), tx, 'has the right transaction')
          end()
        })
    })
  })

  await t.test('on Promise', (t, end) => {
    const { agent, when } = setupTest(t, false)
    const { Promise } = when

    helper.runInTransaction(agent, (tx) => {
      Promise.filter([1, 2, 3, 4], (v) => v % 2).then((value) => {
        assert.equal(value.length, 2)
        assert.equal(agent.getTransaction(), tx, 'has the right transaction')
        end()
      })
    })
  })
})

test('fn.apply', (t, end) => {
  setupTest(t)
  const fn = require('when/function')

  function noop() {}

  const args = [1, 2, 3]
  fn.apply(noop, args).then(end)
})

test('node.apply', (t, end) => {
  setupTest(t)
  const nodefn = require('when/node')

  function nodeStyleFunction(arg1, cb) {
    process.nextTick(cb)
  }

  const args = [1]
  nodefn.apply(nodeStyleFunction, args).then(end).catch(end)
})

/**
 * Tests a `when` library method outside of an agent transaction.
 *
 * @param {object} params The params object
 * @param {object} params.plan The assertion library that expects a set number of
 * assertions to be completed during the test.
 * @param {object} params.agent A mocked agent instance.
 * @param {Function} params.testFunc A function that accepts a "name" parameter and
 * returns a promise. The parameter is a string for identifying the test and
 * values used within the test.
 * @returns {Promise<void>}
 */
async function testThrowOutsideTransaction({ plan, agent, testFunc }) {
  plan.doesNotThrow(() => {
    const name = '[no tx]'
    let isAsync = false
    testFunc(name)
      .finally(() => {
        plan.ok(isAsync, `${name} should have executed asynchronously`)
      })
      .then(
        function resolved() {
          plan.equal(agent.getTransaction(), undefined, `${name} has no transaction`)
        },
        function rejected(error) {
          plan.ok(!error, `${name} should not result in error`)
        }
      )
    isAsync = true
  })
}

/**
 * Tests a `when` library method inside of an agent transaction.
 *
 * @param {object} params The params object
 * @param {object} params.plan The assertion library that expects a set number of
 * assertions to be completed during the test.
 * @param {object} params.agent A mocked agent instance.
 * @param {Function} params.testFunc A function that accepts a "name" parameter and
 * returns a promise. The parameter is a string for identifying the test and
 * values used within the test.
 * @returns {Promise<void>}
 */
async function testInsideTransaction({ plan, agent, testFunc }) {
  helper.runInTransaction(agent, (tx) => {
    const name = '[in tx]'
    plan.doesNotThrow(() => {
      let isAsync = false
      testFunc(name)
        .finally(() => plan.ok(isAsync, `${name} should have executed asynchronously`))
        .then(
          function resolved() {
            plan.equal(agent.getTransaction(), tx, `${name} has the right transaction`)
          },
          function rejected(error) {
            plan.ok(!error, `${name} should not result in error`)
          }
        )
      isAsync = true
    })
  })
}
