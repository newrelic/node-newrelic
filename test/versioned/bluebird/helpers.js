/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const { runMultiple } = require('../../lib/promises/helpers')
const { tspl } = require('@matteo.collina/tspl')
const symbols = require('../../../lib/symbols')
const helper = require('../../lib/agent_helper')
const { setImmediate } = require('timers/promises')

async function beforeEach(ctx) {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.Promise = require('bluebird')
  ctx.nr.tasks = []
  ctx.nr.interval = setInterval(function () {
    if (ctx.nr.tasks.length) {
      ctx.nr.tasks.pop()()
    }
  }, 25)

  await setImmediate()
}

async function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
  clearInterval(ctx.nr.interval)

  await setImmediate()
}

function id(tx) {
  return tx && tx.id
}

function addTask() {
  const args = [].slice.apply(arguments)
  const { tasks } = args.shift() // Pop test context
  const fn = args.shift() // Pop function from args
  tasks.push(function () {
    fn.apply(null, args)
  })
}

function testPromiseClassMethod({ t, count, testFunc, end }) {
  testPromiseMethod({ t, count, factory: testFunc, end })
}

function testPromiseInstanceMethod({ t, count, testFunc, end }) {
  const { Promise } = t.nr
  testPromiseMethod({
    t,
    end,
    count,
    factory: function ({ plan, name }) {
      const promise = Promise.resolve([1, 2, 3, name])
      return testFunc({ plan, name, promise })
    }
  })
}

function testPromiseMethod({ t, count, factory, end }) {
  const { agent } = t.nr
  const COUNT = 2
  const plan = tspl(t, { plan: count * 3 + (COUNT + 1) * 3 })

  plan.doesNotThrow(function outTXPromiseThrowTest() {
    const name = '[no tx] '
    let isAsync = false
    factory({ plan, name })
      .finally(function () {
        plan.ok(isAsync, name + 'should have executed asynchronously')
      })
      .then(
        function () {
          plan.ok(!agent.getTransaction(), name + 'has no transaction')
          testInTransaction()
        },
        function (err) {
          plan.ok(!err)
          end()
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
          plan.doesNotThrow(function inTXPromiseThrowTest() {
            let isAsync = false
            factory({ plan, name })
              .finally(function () {
                plan.ok(isAsync, name + 'should have executed asynchronously')
              })
              .then(
                function () {
                  plan.equal(
                    id(agent.getTransaction()),
                    id(transaction),
                    name + 'has the right transaction'
                  )
                },
                function (err) {
                  plan.ok(!err)
                }
              )
              .finally(cb)
            isAsync = true
          }, name + 'should not throw in a transaction')
        })
      },
      function () {
        end()
      }
    )
  }
}

function areMethodsWrapped(source) {
  const methods = Object.keys(source).sort()
  methods.forEach((method) => {
    const wrapped = source[method]
    const original = wrapped[symbols.original]

    // Skip this property if it is internal (starts or ends with underscore), is
    // a class (starts with a capital letter), or is not a function.
    if (/(?:^[_A-Z]|_$)/.test(method) || typeof original !== 'function') {
      return
    }

    assert.ok(original, `${method} original exists`)
    assert.notEqual(wrapped, original, `${method} wrapped is not diff from original`)
  })
}

module.exports = {
  addTask,
  afterEach,
  areMethodsWrapped,
  beforeEach,
  id,
  testPromiseClassMethod,
  testPromiseInstanceMethod
}
