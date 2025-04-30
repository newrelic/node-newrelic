/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const Segment = require('#agentlib/transaction/trace/segment.js')
const Transaction = require('#agentlib/transaction/index.js')
const hashes = require('#agentlib/util/hashes.js')

const notRunningStates = ['stopped', 'stopping', 'errored']
function beforeEach(ctx) {
  ctx.nr = {}
  const agent = helper.loadMockedAgent()
  ctx.nr.tracer = agent.tracer
  ctx.nr.agent = agent
}

function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
}

test('Tracer', async function (t) {
  await t.test('#transactionProxy', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create transaction', (t, end) => {
      const { tracer } = t.nr
      const wrapped = tracer.transactionProxy(() => {
        const transaction = tracer.getTransaction()
        assert.ok(transaction)
        end()
      })

      wrapped()
    })

    await t.test('should not try to wrap a null handler', function (t) {
      const { tracer } = t.nr
      assert.equal(tracer.transactionProxy(null), null)
    })

    for (const agentState of notRunningStates) {
      await t.test(`should not create transaction when agent state is ${agentState}`, (t) => {
        const { tracer, agent } = t.nr
        agent.setState(agentState)

        const wrapped = tracer.transactionProxy(() => {
          const transaction = tracer.getTransaction()
          assert.ok(!transaction)
        })

        wrapped()
      })
    }
  })

  await t.test('#transactionNestProxy', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create transaction', (t) => {
      const { tracer } = t.nr
      const wrapped = tracer.transactionNestProxy('web', () => {
        const transaction = tracer.getTransaction()
        assert.ok(transaction)
      })

      wrapped()
    })

    for (const agentState of notRunningStates) {
      await t.test(`should not create transaction when agent state is ${agentState}`, (t) => {
        const { tracer, agent } = t.nr
        agent.setState(agentState)

        const wrapped = tracer.transactionNestProxy('web', () => {
          const transaction = tracer.getTransaction()
          assert.ok(!transaction)
        })

        wrapped()
      })
    }

    await t.test(
      'when proxying a trace segment should not try to wrap a null handler',
      function (t, end) {
        const { tracer, agent } = t.nr
        helper.runInTransaction(agent, function () {
          assert.equal(tracer.wrapFunction('123', null, null), null)
          end()
        })
      }
    )

    await t.test(
      'when proxying a callback should not try to wrap a null handler',
      function (t, end) {
        const { tracer, agent } = t.nr
        helper.runInTransaction(agent, function () {
          assert.equal(tracer.bindFunction(null), null)
          end()
        })
      }
    )

    await t.test(
      'when handling immutable errors should not break in annotation process',
      function (t, end) {
        const expectErrMsg = 'FIREBOMB'
        const { tracer, agent } = t.nr
        helper.runInTransaction(agent, function (trans) {
          function wrapMe() {
            const err = new Error(expectErrMsg)
            Object.freeze(err)
            throw err
          }

          assert.throws(() => {
            const segment = new Segment({ name: 'name', isRoot: false, root: trans.trace.root })
            let context = tracer.getContext()
            context = context.enterSegment({ segment })
            const fn = tracer.bindFunction(wrapMe, context)
            fn()
          }, /Error: FIREBOMB/)
          end()
        })
      }
    )

    await t.test(
      'when a transaction is created inside a transaction should reuse the existing transaction instead of nesting',
      function (t, end) {
        const { agent } = t.nr
        helper.runInTransaction(agent, function (outerTransaction) {
          const outerId = outerTransaction.id
          helper.runInTransaction(agent, function (innerTransaction) {
            const innerId = innerTransaction.id

            assert.equal(innerId, outerId)
            end()
          })
        })
      }
    )
  })

  await t.test('Optional callback', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should call an optional callback function', (t, end) => {
      const { agent } = t.nr
      const trans = new Transaction(agent)
      const trace = trans.trace

      assert.doesNotThrow(function noCallback() {
        trace.add('UnitTest', null, null)
      })

      const working = trace.add(
        'UnitTest',
        function () {
          end()
        },
        null,
        false,
        function () {}
      )

      working.end()
      trans.end()
    })

    await t.test('accepts a callback that records metrics for this segment', (t, end) => {
      const { agent } = t.nr
      const trans = new Transaction(agent)
      const trace = trans.trace

      const segment = trace.add(
        'Test',
        (insider) => {
          assert.equal(insider, segment)
          end()
        },
        null,
        false,
        function () {}
      )
      segment.end()
      trans.end()
    })
  })

  await t.test('increment segments', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('properly tracks the number of active or harvested segments', (t, end) => {
      const { agent, tracer } = t.nr
      assert.equal(agent.activeTransactions, 0)
      assert.equal(agent.totalActiveSegments, 0)
      assert.equal(agent.segmentsCreatedInHarvest, 0)

      const tx = new Transaction(agent)
      tracer.setSegment({ transaction: tx, segment: tx.trace.root })
      assert.equal(agent.totalActiveSegments, 1)
      assert.equal(agent.segmentsCreatedInHarvest, 1)
      assert.equal(tx.numSegments, 1)
      assert.equal(agent.activeTransactions, 1)
      assert.equal(tx.trace.segments.root.children.length, 0)

      tracer.createSegment({ name: 'Test', parent: tx.trace.root, transaction: tx })
      assert.equal(agent.totalActiveSegments, 2)
      assert.equal(agent.segmentsCreatedInHarvest, 2)
      assert.equal(tx.numSegments, 2)
      assert.equal(tx.trace.segments.root.children.length, 1)
      tx.end()

      assert.equal(agent.activeTransactions, 0)

      setTimeout(function () {
        assert.equal(agent.totalActiveSegments, 0)
        assert.equal(agent.segmentsClearedInHarvest, 2)

        agent.forceHarvestAll(() => {
          assert.equal(agent.totalActiveSegments, 0)
          assert.equal(agent.segmentsClearedInHarvest, 0)
          assert.equal(agent.segmentsCreatedInHarvest, 0)
          end()
        })
      }, 10)
    })
    await t.test('skip adding children when parent is opaque', (t) => {
      const { agent, tracer } = t.nr
      const tx = new Transaction(agent)
      tracer.setSegment({ transaction: tx, segment: tx.trace.root })
      const segment = tracer.createSegment({ name: 'Test', parent: tx.trace.root, transaction: tx })
      segment.opaque = true
      const segment2 = tracer.createSegment({ name: 'Test1', parent: segment, transaction: tx })
      const segment3 = tracer.createSegment({ name: 'Test2', parent: segment, transaction: tx })
      assert.equal(segment2.id, segment.id)
      assert.equal(segment3.id, segment.id)
      assert.equal(tx.trace.segments.root.children.length, 1)
      tx.end()
    })
  })

  await t.test('#createSegment', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should assign segment id if passed in', (t) => {
      const { agent, tracer } = t.nr
      const tx = new Transaction(agent)
      const id = hashes.makeId()
      const segment = tracer.createSegment({ id, name: 'Test', parent: tx.trace.root, transaction: tx })
      assert.equal(segment.id, id)
      tx.end()
    })

    await t.test('should stop adding segments to trace when `max_trace_segments` is exceeded', (t) => {
      const { agent, tracer } = t.nr
      const tx = new Transaction(agent)

      const ar = new Array(1000).fill('a')
      ar.forEach((_el, i) => {
        tracer.createSegment({ name: `Test Segment ${i}`, parent: tx.trace.root, transaction: tx })
      })

      const [,,,,childSegments] = tx.trace.toJSON()
      // max_trace_segments is 900(ROOT + 899 child segments
      assert.equal(childSegments.length, 899)
    })
  })
})
