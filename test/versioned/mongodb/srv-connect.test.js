/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const dns = require('node:dns')
const { setImmediate } = require('node:timers/promises')

const params = require('../../lib/params')
const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const common = require('./common')

// Reproduces https://github.com/newrelic/node-newrelic/issues/4154
//
// When a `MongoClient` is created from a `mongodb+srv://` connection string,
// the driver leaves `options.hosts` as an empty array until DNS SRV resolution
// completes during `client.connect()`. The mongodb subscribers fire on `Db`
// and `Collection` construction (before connect), so `getHostDetails` reading
// `options.hosts[0].host` throws a `TypeError`. Because the throw happens
// inside a `diagnostics_channel` publish, it can surface on a later tick as an
// uncaught exception rather than propagating to the `client.db()` /
// `db.collection()` caller.
//
// To assert this synchronously each test installs an `uncaughtException`
// listener, performs the construction, then flushes the tick queue with a
// single `await setImmediate()` before asserting no error was captured. This
// is deterministic — it does not rely on the test runner observing a throw
// after the test has already ended.
//
// The `mongodb+srv://` scheme requires DNS SRV resolution, so — following the
// pattern in `test/integration/core/dns.test.js` — we patch `dns` to resolve
// the fake SRV hostname to the local Docker MongoDB container. This lets the
// tests exercise the real connect path (not just construction) against a live
// server.

// The SRV target name must share the parent domain of `SRV_HOST` or the driver
// rejects it (see `matchesParentDomain` in the mongodb driver).
const SRV_HOST = 'cluster0.example.mongodb.net'
const SRV_TARGET = `localhost.example.${SRV_HOST.split('.').slice(-2).join('.')}`
// `mongodb+srv://` forces TLS on by default; the local container is plaintext.
const SRV_URI = `mongodb+srv://${SRV_HOST}/${common.DB_NAME}?tls=false`

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.mongodb = require('mongodb')

  // Patch DNS so the SRV lookup resolves to the local Docker container.
  ctx.nr.dns = {
    resolve: dns.promises.resolve,
    resolveSrv: dns.promises.resolveSrv,
    resolveTxt: dns.promises.resolveTxt,
    lookup: dns.lookup
  }

  // The SRV lookup resolves to the local Docker container.
  const srvRecords = [
    { name: SRV_TARGET, port: Number(params.mongodb_port), weight: 0, priority: 0 }
  ]
  const noTxtRecord = () => {
    const error = new Error('no TXT record')
    error.code = 'ENODATA'
    throw error
  }

  // Different driver versions resolve SRV/TXT differently: mongodb@4–6 call the
  // dedicated `dns.promises.resolveSrv` / `resolveTxt`, while mongodb@7+ calls
  // `dns.promises.resolve(address, rrtype)`. Patch all of them.
  dns.promises.resolveSrv = async () => srvRecords
  dns.promises.resolveTxt = noTxtRecord
  dns.promises.resolve = async (address, rrtype) => {
    if (rrtype === 'SRV') {
      return srvRecords
    }
    if (rrtype === 'TXT') {
      return noTxtRecord()
    }
    return ctx.nr.dns.resolve(address, rrtype)
  }
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    // Redirect the fake SRV target to the real Mongo host.
    const target = hostname === SRV_TARGET ? params.mongodb_host : hostname
    return ctx.nr.dns.lookup(target, options, callback)
  }

  // Capture the deferred subscriber error synchronously.
  ctx.nr.uncaught = []
  ctx.nr.onUncaught = (err) => ctx.nr.uncaught.push(err)
  process.on('uncaughtException', ctx.nr.onUncaught)
})

test.afterEach(async (ctx) => {
  process.removeListener('uncaughtException', ctx.nr.onUncaught)
  dns.promises.resolve = ctx.nr.dns.resolve
  dns.promises.resolveSrv = ctx.nr.dns.resolveSrv
  dns.promises.resolveTxt = ctx.nr.dns.resolveTxt
  dns.lookup = ctx.nr.dns.lookup

  if (ctx.nr.client) {
    await ctx.nr.client.close(true)
  }
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['mongodb'])
})

test('client.db() before connect should not throw', async (t) => {
  const { mongodb, uncaught } = t.nr
  const client = new mongodb.MongoClient(SRV_URI)
  t.nr.client = client

  // `options.hosts` is `[]` here because SRV resolution only happens during
  // `connect()`.
  assert.deepEqual(client.options.hosts, [], 'hosts should be empty before connect')

  const db = client.db()
  assert.ok(db, 'should return a db handle')

  // Flush the tick queue so any deferred subscriber error is captured.
  await setImmediate()
  assert.deepEqual(uncaught, [], 'creating a Db handle from an SRV client should not throw')
})

test('db.collection() before connect should not throw', async (t) => {
  const { mongodb, uncaught } = t.nr
  const client = new mongodb.MongoClient(SRV_URI)
  t.nr.client = client
  const db = client.db()

  // `client.db()` also fires the buggy publish; drop anything it captured so we
  // only assert against `db.collection()`.
  await setImmediate()
  uncaught.length = 0

  const collection = db.collection('users')
  assert.ok(collection, 'should return a collection handle')

  // Flush the tick queue so any deferred subscriber error is captured.
  await setImmediate()
  assert.deepEqual(uncaught, [], 'creating a Collection handle from an SRV client should not throw')
})

test('operations over an SRV connection are instrumented', async (t) => {
  const { agent, mongodb, uncaught } = t.nr
  const client = new mongodb.MongoClient(SRV_URI)
  t.nr.client = client

  // Create handles before connect — the crashing code path from the issue.
  const db = client.db()
  const collection = db.collection(common.COLLECTIONS.collection1)

  await client.connect()
  assert.deepEqual(
    client.options.hosts.map((h) => h.host),
    [SRV_TARGET],
    'hosts should be populated from SRV resolution after connect'
  )

  await helper.runInTransaction(agent, async (transaction) => {
    transaction.name = common.TRANSACTION_NAME
    await collection.findOne({ i: 0 })

    const children = transaction.trace.getChildren(transaction.trace.root.id)
    const mongoSegment = children.find((c) => common.MONGO_SEGMENT_RE.test(c.name))
    assert.ok(mongoSegment, 'should create a MongoDB segment')

    // Host details are resolved at operation time, so even though the handles
    // were created before `hosts` was populated, the segment should carry the
    // server name that SRV resolution produced during `connect()`.
    const attributes = mongoSegment.getAttributes()
    assert.equal(attributes.product, 'MongoDB', 'should have product attribute')
    assert.equal(attributes.database_name, common.DB_NAME, 'should have database name attribute')
    assert.equal(attributes.host, SRV_TARGET, 'should attribute the SRV-resolved server name')
    assert.equal(
      attributes.port_path_or_id,
      common.getPort(),
      'should attribute the SRV-resolved port'
    )

    transaction.end()
  })

  await setImmediate()
  assert.deepEqual(uncaught, [], 'instrumented SRV operations should not throw')
})

test('an operation issued before SRV resolution degrades gracefully', async (t) => {
  const { agent, mongodb } = t.nr

  // Force SRV resolution to fail so the client never populates `hosts`. This
  // guarantees the instrumented operation runs while `options.hosts` is empty,
  // exercising the `getHostDetails` guard directly. Without the guard this
  // path throws a `TypeError` from the subscriber; with it, instrumentation
  // records the segment with host/port omitted and lets the driver's own
  // connection error surface.
  const srvError = () => {
    const error = new Error('SRV resolution failed')
    error.code = 'ENOTFOUND'
    throw error
  }
  dns.promises.resolveSrv = srvError
  dns.promises.resolve = async (address, rrtype) => {
    if (rrtype === 'SRV' || rrtype === 'TXT') {
      return srvError()
    }
    return t.nr.dns.resolve(address, rrtype)
  }

  const client = new mongodb.MongoClient(SRV_URI)
  t.nr.client = client
  const collection = client.db().collection(common.COLLECTIONS.collection1)
  assert.deepEqual(client.options.hosts, [], 'hosts should be empty before connect')

  await helper.runInTransaction(agent, async (transaction) => {
    transaction.name = common.TRANSACTION_NAME
    // `serverSelectionTimeoutMS` only matters as a fail-fast guard: SRV
    // resolution fails first (above), so we never reach server selection. But
    // if the SRV stub ever regresses and resolution succeeds, this keeps the
    // test from hanging on the driver's 30s default before rejecting.
    await assert.rejects(
      collection.findOne({ i: 0 }, { serverSelectionTimeoutMS: 100 }),
      (err) => {
        // Must be a driver resolution error, not a `TypeError` leaking from the
        // subscriber's host-details lookup.
        assert.notEqual(err.name, 'TypeError', 'instrumentation should not throw a TypeError')
        assert.equal(err.code, 'ENOTFOUND')
        assert.equal(err.message, 'SRV resolution failed')
        return true
      }
    )

    const children = transaction.trace.getChildren(transaction.trace.root.id)
    const mongoSegment = children.find((c) => common.MONGO_SEGMENT_RE.test(c.name))
    assert.ok(mongoSegment, 'should still create a MongoDB segment')

    const attributes = mongoSegment.getAttributes()
    assert.equal(attributes.product, 'MongoDB', 'should have product attribute')
    assert.equal(attributes.host, undefined, 'should omit host when hosts is empty')
    assert.equal(
      attributes.port_path_or_id,
      undefined,
      'should omit port when hosts is empty'
    )

    transaction.end()
  })
})
