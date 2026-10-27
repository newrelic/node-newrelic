/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Regression test for https://github.com/newrelic/node-newrelic/issues/4397
//
// The MongoDB subscriber instrumentation (added in the shim -> subscriber
// rewrite) installs a fresh per-instance wrapped method on every constructed
// cursor. Because `collection.find()` constructs a new cursor per call, a
// read-heavy workload allocates a new set of closures for every query. That
// per-operation allocation churn, interleaved with the driver's large
// off-heap BSON buffers, drives the unbounded off-heap (RSS) growth reported
// in #4397 while the JS heap stays flat.
//
// These assertions capture the root-cause invariant rather than the slow,
// environment-sensitive memory symptom: the instrumentation should wrap the
// driver's prototype methods once, not mutate the shape of every cursor
// instance.
//
// The two shape assertions are skipped when the security agent is enabled: it
// legitimately installs its own per-instance wrappers on mongodb objects, so a
// cursor will carry own `toArray`/`next` properties that are not from this
// agent. The `#4397` invariant being guarded here is about *this* agent's
// instrumentation, which the security agent's presence makes unobservable via
// object shape alone. The datastore-segment assertion still runs in both modes.

const { describe, test } = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const { COLLECTIONS, DB_NAME, MONGO_SEGMENT_RE } = common

describe('mongodb instrumentation does not mutate per-cursor shape (#4397)', () => {
  test.beforeEach(async (ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()

    const mongodb = require('mongodb')
    ctx.nr.mongodb = mongodb

    const { client, db } = await common.connect({ mongodb, name: DB_NAME })
    ctx.nr.client = client
    ctx.nr.db = db
    ctx.nr.collection = db.collection(COLLECTIONS.collection1)

    // A few documents are enough; this test asserts object shape, not timing.
    await ctx.nr.collection.insertMany([
      { i: 0 },
      { i: 1 },
      { i: 2 }
    ])
  })

  test.afterEach(afterEach)

  // Idempotent: the skip path below invokes this directly before returning, and
  // the registered hook also runs, so guard against tearing down twice.
  async function afterEach(ctx) {
    if (ctx.nr.tornDown === true) {
      return
    }
    ctx.nr.tornDown = true
    await ctx.nr.collection.deleteMany({})
    await common.close(ctx.nr.client, ctx.nr.db)
    helper.unloadAgent(ctx.nr.agent)
    removeModules(['mongodb'])
  }

  test('cursor read methods come from the prototype, not the instance', async (t) => {
    const { agent, collection } = t.nr
    if (helper.isSecurityAgentEnabled(agent) === true) {
      t.skip('security agent installs its own per-instance wrappers on mongodb objects')
      await afterEach(t)
      return
    }

    // Constructing a cursor must not require an active transaction to trigger
    // the instrumentation's construction hook.
    const cursor = collection.find({})
    const proto = Object.getPrototypeOf(cursor)

    assert.equal(
      Object.prototype.hasOwnProperty.call(cursor, 'toArray'),
      false,
      'cursor should inherit `toArray` from its prototype, not carry a per-instance own property'
    )
    assert.equal(
      Object.prototype.hasOwnProperty.call(cursor, 'next'),
      false,
      'cursor should inherit `next` from its prototype, not carry a per-instance own property'
    )
    assert.equal(
      cursor.toArray,
      proto.toArray,
      'cursor `toArray` should resolve to the prototype method'
    )
  })

  test('distinct cursors share the same wrapped method reference', async (t) => {
    const { agent, collection } = t.nr
    if (helper.isSecurityAgentEnabled(agent) === true) {
      t.skip('security agent installs its own per-instance wrappers on mongodb objects')
      await afterEach(t)
      return
    }

    // Each `find()` constructs a fresh cursor. The wrapper function should be
    // shared across instances (wrapped once on the prototype), not allocated
    // per cursor. Distinct function identities here are the allocation-churn
    // signature behind the off-heap growth in #4397.
    const cursorA = collection.find({})
    const cursorB = collection.find({})

    assert.equal(
      cursorA.toArray,
      cursorB.toArray,
      'two cursors should share one `toArray` function (wrapped once), not get a fresh closure each'
    )
    assert.equal(
      cursorA.next,
      cursorB.next,
      'two cursors should share one `next` function (wrapped once), not get a fresh closure each'
    )
  })

  test('instrumentation still records the datastore segment', (t, end) => {
    const { agent, collection } = t.nr

    // Guard rail: a shape fix must not silently drop instrumentation. This
    // assertion passes both before and after a fix.
    helper.runInTransaction(agent, async function (transaction) {
      transaction.name = common.TRANSACTION_NAME

      const docs = await collection.find({}).toArray()
      assert.equal(docs.length, 3, 'should read the seeded documents')

      const root = transaction.trace.root
      const children = transaction.trace.getChildren(root.id)
      const mongoSegment = children.find((child) => MONGO_SEGMENT_RE.test(child.name))

      assert.ok(mongoSegment, 'should create a MongoDB datastore segment for the read')
      assert.match(
        mongoSegment.name,
        /\/toArray$/,
        'segment should be named for the `toArray` operation'
      )

      transaction.end()
      end()
    })
  })
})
