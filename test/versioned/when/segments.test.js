/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')

const { removeModules } = require('../../lib/cache-buster')
const assertSegments = require('../../lib/custom-assertions/assert-segments')
const helper = require('../../lib/agent_helper')

// simulates a function that returns a promise and has a segment created for itself
function doSomeWork({ tracer, Promise = global.Promise, segmentName, shouldReject } = {}) {
  const segment = tracer.createSegment(segmentName)
  return tracer.bindFunction(actualWork, segment)()

  function actualWork() {
    segment.touch()

    return new Promise(function startSomeWork(resolve, reject) {
      if (shouldReject) {
        process.nextTick(function () {
          reject('some reason')
        })
      } else {
        process.nextTick(function () {
          resolve(123)
        })
      }
    })
  }
}

test('segments enabled', async (t) => {
  test.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      feature_flag: { promise_segments: true }
    })
    ctx.nr.tracer = ctx.nr.agent.tracer
    ctx.nr.when = require('when')
  })

  test.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    removeModules(['when'])
  })

  await t.test('child segment is created inside then handler', async (t) => {
    const plan = tspl(t, { plan: 10 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', (tx) => {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(
        tx.trace.root,
        [
          'doSomeWork',
          ['Promise startSomeWork', ['Promise#then <anonymous>', ['someChildSegment']]]
        ],
        {},
        { assert: plan }
      )
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, Promise: when.Promise, segmentName: 'doSomeWork' }).then(function () {
        const childSegment = tracer.createSegment('someChildSegment')
        // touch the segment, so that it is not truncated
        childSegment.touch()
        tracer.bindFunction(function () {}, childSegment)
        process.nextTick(transaction.end.bind(transaction))
      })
    })

    await plan.completed
  })

  await t.test('then handler that returns a new promise', async (t) => {
    const plan = tspl(t, { plan: 8 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)
      assertSegments(
        tx.trace.root,
        [
          'doWork1',
          [
            'Promise startSomeWork',
            [
              'Promise#then firstThen',
              [
                'doWork2',
                ['Promise startSomeWork', ['Promise#then <anonymous>', 'Promise#then secondThen']]
              ]
            ]
          ]
        ],
        { exact: false },
        { assert: plan }
      )
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, segmentName: 'doWork1', Promise: when.Promise })
        .then(function firstThen() {
          return doSomeWork({ tracer, segmentName: 'doWork2', Promise: when.Promise })
        })
        .then(function secondThen() {
          const s = tracer.createSegment('secondThen')
          s.start()
          s.end()
          process.nextTick(transaction.end.bind(transaction))
        })
    })

    await plan.completed
  })

  await t.test('then handler that returns a value', async (t) => {
    const plan = tspl(t, { plan: 10 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(
        tx.trace.root,
        [
          'doWork1',
          ['Promise startSomeWork', ['Promise#then firstThen', ['Promise#then secondThen']]]
        ],
        {},
        { assert: plan }
      )
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, segmentName: 'doWork1', Promise: when.Promise })
        .then(function firstThen() {
          return 'some value'
        })
        .then(function secondThen() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })

    await plan.completed
  })

  await t.test('catch handler with error from original promise', async (t) => {
    const plan = tspl(t, { plan: 8 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(
        tx.trace.root,
        ['doWork1', ['Promise startSomeWork', ['Promise#catch catchHandler']]],
        {},
        { assert: plan }
      )
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, segmentName: 'doWork1', shouldReject: true, Promise: when.Promise })
        .then(function firstThen() {
          return 'some value'
        })
        .catch(function catchHandler() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })

    await plan.completed
  })

  await t.test('catch handler with error from subsequent promise', async (t) => {
    const plan = tspl(t, { plan: 7 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(
        tx.trace.root,
        [
          'doWork1',
          [
            'Promise startSomeWork',
            [
              'Promise#then firstThen',
              ['doWork2', ['Promise startSomeWork', ['Promise#catch catchHandler']]]
            ]
          ]
        ],
        { exact: false },
        { assert: plan }
      )
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, segmentName: 'doWork1', Promise: when.Promise })
        .then(function firstThen() {
          return doSomeWork({
            tracer,
            segmentName: 'doWork2',
            shouldReject: true,
            Promise: when.Promise
          })
        })
        .then(function secondThen() {
          const s = tracer.createSegment('secondThen')
          s.start()
          s.end()
        })
        .catch(function catchHandler() {
          const s = tracer.createSegment('catchHandler')
          s.start()
          s.end()
          process.nextTick(transaction.end.bind(transaction))
        })
    })

    await plan.completed
  })

  await t.test('when promise is created beforehand', async (t) => {
    const plan = tspl(t, { plan: 8 })
    const { agent, tracer, when } = t.nr
    const { Promise } = when

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 2)

      assertSegments(
        tx.trace.root,
        ['Promise startSomeWork', ['Promise#then myThen'], 'doSomeWork'],
        { exact: true },
        { assert: plan }
      )
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      let resolve
      const p = new Promise(function startSomeWork(r) {
        resolve = r
      })

      const segment = tracer.createSegment('doSomeWork')
      resolve = tracer.bindFunction(resolve, segment)

      p.then(function myThen() {
        segment.touch()
        process.nextTick(transaction.end.bind(transaction))
      })

      // Simulate call that resolves the promise, but its segment is created
      // after the promise is created
      resolve()
    })

    await plan.completed
  })
})

test('segments disabled', async (t) => {
  test.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      feature_flag: { promise_segments: false }
    })
    ctx.nr.tracer = ctx.nr.agent.tracer
    ctx.nr.when = require('when')
  })

  test.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    removeModules(['when'])
  })

  await t.test('child segment is created inside then handler', async (t) => {
    const plan = tspl(t, { plan: 6 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(tx.trace.root, ['doSomeWork', ['someChildSegment']], {}, { assert: plan })
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, segmentName: 'doSomeWork', Promise: when.Promise }).then(function () {
        const childSegment = tracer.createSegment('someChildSegment')
        // touch the segment, so that it is not truncated
        childSegment.touch()
        tracer.bindFunction(function () {}, childSegment)
        process.nextTick(transaction.end.bind(transaction))
      })
    })

    await plan.completed
  })

  await t.test('then handler that returns a new promise', async (t) => {
    const plan = tspl(t, { plan: 4 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(tx.trace.root, ['doWork1'], {}, { assert: plan })
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, segmentName: 'doWork1', Promise: when.Promise })
        .then(function firstThen() {
          return new Promise(function secondChain(res) {
            res()
          })
        })
        .then(function secondThen() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })

    await plan.completed
  })

  await t.test('then handler that returns a value', async (t) => {
    const plan = tspl(t, { plan: 4 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(tx.trace.root, ['doWork1'], {}, { assert: plan })
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, segmentName: 'doWork1', Promise: when.Promise })
        .then(function firstThen() {
          return 'some value'
        })
        .then(function secondThen() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })

    await plan.completed
  })

  await t.test('catch handler with error from original promise', async (t) => {
    const plan = tspl(t, { plan: 4 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(tx.trace.root, ['doWork1'], {}, { assert: plan })
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, segmentName: 'doWork1', shouldReject: true, Promise: when.Promise })
        .then(function firstThen() {
          return 'some value'
        })
        .catch(function catchHandler() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })

    await plan.completed
  })

  await t.test('catch handler with error from subsequent promise', async (t) => {
    const plan = tspl(t, { plan: 6 })
    const { agent, tracer, when } = t.nr

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(tx.trace.root, ['doWork1', ['doWork2']], {}, { assert: plan })
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork({ tracer, segmentName: 'doWork1', Promise: when.Promise })
        .then(function firstThen() {
          return doSomeWork({
            tracer,
            segmentName: 'doWork2',
            shouldReject: true,
            Promise: when.Promise
          })
        })
        .then(function secondThen() {})
        .catch(function catchHandler() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })

    await plan.completed
  })

  await t.test('when promise is created beforehand', async (t) => {
    const plan = tspl(t, { plan: 4 })
    const { agent, tracer, when } = t.nr
    const { Promise } = when

    agent.once('transactionFinished', function (tx) {
      plan.equal(tx.trace.root.children.length, 1)

      assertSegments(tx.trace.root, ['doSomeWork'], { exact: true }, { assert: plan })
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      let resolve
      const p = new Promise(function startSomeWork(r) {
        resolve = r
      })

      const segment = tracer.createSegment('doSomeWork')
      resolve = tracer.bindFunction(resolve, segment)

      p.then(function myThen() {
        segment.touch()
        process.nextTick(transaction.end.bind(transaction))
      })

      // Simulate call that resolves the promise, but its segment is created
      // after the promise is created.
      resolve()
    })

    await plan.completed
  })
})
