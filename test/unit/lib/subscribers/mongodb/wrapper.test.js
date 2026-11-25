/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { setTimeout } = require('node:timers/promises')
const v8 = require('node:v8')
const vm = require('node:vm')

const helper = require('#testlib/agent_helper.js')
const CursorSubscriber = require('#agentlib/subscribers/mongodb/cursor.js')

// Plain functions: sinon stubs record every call, which retains objects.
const logger = { trace() {}, debug() {}, child() { return this } }

test.beforeEach((ctx) => {
  class MongoClient {
    constructor() {
      this.options = { hosts: [{ host: 'db.example.com', port: 27017 }] }
    }
  }

  class FakeCursor {
    constructor() {
      this.client = new MongoClient()
      this.namespace = { db: 'test', collection: 'things' }
    }

    async toArray() {
      return []
    }
  }

  const agent = helper.loadMockedAgent()
  const subscriber = new CursorSubscriber({ agent, logger })
  subscriber.end({ self: new FakeCursor() })
  ctx.nr = { agent, FakeCursor }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should record metrics for the operation', async (t) => {
  const { agent, FakeCursor } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    await new FakeCursor().toArray()
    tx.end()
    for (const name of [
      'Datastore/operation/MongoDB/toArray',
      'Datastore/statement/MongoDB/things/toArray',
      'Datastore/instance/MongoDB/db.example.com/27017'
    ]) {
      assert.equal(tx.metrics.getMetric(name)?.callCount, 1, name)
    }
  })
})

test('should not retain the instance until the transaction ends', async (t) => {
  const { agent, FakeCursor } = t.nr
  v8.setFlagsFromString('--expose-gc')
  const gc = vm.runInNewContext('gc')

  await helper.runInTransaction(agent, async (tx) => {
    const refs = []
    for (let i = 0; i < 20; i++) {
      const cursor = new FakeCursor()
      refs.push(new WeakRef(cursor))
      await cursor.toArray()
    }

    // A new macrotask, so that nothing on the stack holds a cursor.
    await setTimeout(10)
    gc()
    const alive = refs.filter((ref) => ref.deref() !== undefined).length
    assert.equal(tx.isActive(), true)
    // The engine may still hold the last cursor.
    assert.ok(alive <= 1, `${alive} cursors still reachable`)
    tx.end()
  })
})
