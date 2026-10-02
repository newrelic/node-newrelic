/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const dns = require('dns')
const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify.js')
const sinon = require('sinon')
const mockDns = require('./dns-utils')

// `resolveTlsa` was added in Node.js 22.15.0
const skipTlsa = typeof dns.resolveTlsa !== 'function'

function beforeEach(ctx) {
  const sandbox = sinon.createSandbox()
  ctx.nr = {}
  ctx.nr.sandbox = sandbox

  mockDns({ dns, sandbox })
  ctx.nr.agent = helper.instrumentMockedAgent()
}

function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.sandbox.restore()
}

test('callback', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('lookup - IPv4', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.lookup('localhost', { verbatim: false }, function (err, ip, v) {
        assert.ok(!err, 'should not error')
        assert.equal(ip, '127.0.0.1')
        assert.equal(v, 4)
        verifySegments({ agent, end, name: 'dns.lookup', assertCallbacks: false })
      })
    })
  })

  await t.test('lookup - IPv6', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      // Verbatim defaults to true in Node 18+
      dns.lookup('localhost', { verbatim: true }, function (err, ip, v) {
        assert.ok(!err, 'should not error')
        assert.equal(ip, '::1')
        assert.equal(v, 6)
        verifySegments({ agent, end, name: 'dns.lookup', assertCallbacks: false })
      })
    })
  })

  await t.test('resolve', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolve('example.com', function (err, ips) {
        assert.ok(!err, 'should not error')
        assert.equal(ips.length, 1)
        assert.equal(ips[0], '127.0.0.1')

        verifySegments({ agent, end, name: 'dns.resolve', assertCallbacks: false })
      })
    })
  })

  await t.test('resolve4', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolve4('example.com', function (err, ips) {
        assert.ok(!err, 'should not error')
        assert.equal(ips.length, 1)
        assert.equal(ips[0], '127.0.0.1')
        verifySegments({ agent, end, name: 'dns.resolve4', assertCallbacks: false })
      })
    })
  })

  await t.test('resolve4 after setServers', function (t, end) {
    const { agent } = t.nr
    // `setServers` rebinds the module-level methods from `Resolver.prototype`,
    // replacing the wrappers on the module itself
    dns.setServers(dns.getServers())
    helper.runInTransaction(agent, function () {
      dns.resolve4('example.com', function (err, ips) {
        assert.ok(!err, 'should not error')
        assert.equal(ips.length, 1)
        assert.equal(ips[0], '127.0.0.1')
        verifySegments({ agent, end, name: 'dns.resolve4', assertCallbacks: false })
      })
    })
  })

  await t.test('resolve6', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolve6('example.com', function (err, ips) {
        assert.ok(!err, 'should not error')
        assert.equal(ips.length, 1)
        assert.equal(ips[0], '::1')
        verifySegments({ agent, end, name: 'dns.resolve6', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveAny', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveAny('example.com', function (err, records) {
        assert.ok(!err, 'should not error')
        assert.equal(records.length, 1)
        assert.equal(records[0].type, 'A')
        assert.equal(records[0].address, '127.0.0.1')
        verifySegments({ agent, end, name: 'dns.resolveAny', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveCaa', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveCaa('example.com', function (err, records) {
        assert.ok(!err, 'should not error')
        assert.deepEqual(records, [{ critical: 0, issue: 'ca.example.net' }])
        verifySegments({ agent, end, name: 'dns.resolveCaa', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveCname', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveCname('example.com', function (err) {
        assert.equal(err.code, 'ENODATA')
        verifySegments({ agent, end, name: 'dns.resolveCname', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveMx', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveMx('example.com', function (err, ips) {
        assert.ok(!err, 'should not error')
        assert.equal(ips.length, 1)
        assert.equal(ips[0], '127.0.0.1')

        verifySegments({ agent, end, name: 'dns.resolveMx', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveNaptr', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveNaptr('example.com', function (err, records) {
        assert.ok(!err, 'should not error')
        assert.equal(records.length, 1)
        assert.equal(records[0].replacement, '_sip._udp.example.com')
        verifySegments({ agent, end, name: 'dns.resolveNaptr', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveNs', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveNs('example.com', function (err, names) {
        assert.ok(!err, 'should not error')
        assert.deepEqual(names.sort(), ['a.iana-servers.net', 'b.iana-servers.net'])
        verifySegments({ agent, end, name: 'dns.resolveNs', assertCallbacks: false })
      })
    })
  })

  await t.test('resolvePtr', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolvePtr('example.com', function (err, names) {
        assert.ok(!err, 'should not error')
        assert.deepEqual(names, ['localhost'])
        verifySegments({ agent, end, name: 'dns.resolvePtr', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveSoa', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveSoa('example.com', function (err, soa) {
        assert.ok(!err, 'should not error')
        assert.equal(soa.nsname, 'ns.example.com')
        assert.equal(soa.hostmaster, 'root.example.com')
        verifySegments({ agent, end, name: 'dns.resolveSoa', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveTlsa', { skip: skipTlsa }, function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveTlsa('example.com', function (err, records) {
        assert.ok(!err, 'should not error')
        assert.equal(records.length, 1)
        assert.equal(records[0].certUsage, 3)
        verifySegments({ agent, end, name: 'dns.resolveTlsa', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveTxt', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveTxt('example.com', function (err, data) {
        assert.ok(!err, 'should not error')
        assert.deepEqual(data, ['one', 'two', 'three'])
        assert.ok(Array.isArray(data))
        verifySegments({ agent, end, name: 'dns.resolveTxt', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveSrv', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.resolveSrv('example.com', function (err) {
        assert.equal(err.code, 'ENODATA')
        verifySegments({ agent, end, name: 'dns.resolveSrv', assertCallbacks: false })
      })
    })
  })

  await t.test('reverse', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function () {
      dns.reverse('127.0.0.1', function (err, names) {
        assert.ok(!err, 'should not error')
        assert.equal(names.length, 1)
        assert.equal(names[0], 'localhost')
        verifySegments({ agent, end, name: 'dns.reverse', assertCallbacks: false })
      })
    })
  })
})

test('promises', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('lookup - IPv4', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const { address, family } = await dns.promises.lookup('localhost', { verbatim: false })
      assert.equal(address, '127.0.0.1')
      assert.equal(family, 4)
      verifySegments({ agent, name: 'dns.lookup', assertCallbacks: false })
    })
  })

  await t.test('resolve', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const ips = await dns.promises.resolve('example.com')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '127.0.0.1')

      verifySegments({ agent, name: 'dns.resolve', assertCallbacks: false })
    })
  })

  await t.test('resolve4', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const ips = await dns.promises.resolve4('example.com')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '127.0.0.1')
      verifySegments({ agent, name: 'dns.resolve4', assertCallbacks: false })
    })
  })

  await t.test('resolve6', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const ips = await dns.promises.resolve6('example.com')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '::1')
      verifySegments({ agent, name: 'dns.resolve6', assertCallbacks: false })
    })
  })

  await t.test('resolveAny', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const records = await dns.promises.resolveAny('example.com')
      assert.equal(records.length, 1)
      assert.equal(records[0].type, 'A')
      assert.equal(records[0].address, '127.0.0.1')
      verifySegments({ agent, name: 'dns.resolveAny', assertCallbacks: false })
    })
  })

  await t.test('resolveCaa', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const records = await dns.promises.resolveCaa('example.com')
      assert.deepEqual(records, [{ critical: 0, issue: 'ca.example.net' }])
      verifySegments({ agent, name: 'dns.resolveCaa', assertCallbacks: false })
    })
  })

  await t.test('resolveCname', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      await assert.rejects(() => dns.promises.resolveCname('example.com'))
      verifySegments({ agent, name: 'dns.resolveCname', assertCallbacks: false })
    })
  })

  await t.test('resolveMx', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const ips = await dns.promises.resolveMx('example.com')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '127.0.0.1')
      verifySegments({ agent, name: 'dns.resolveMx', assertCallbacks: false })
    })
  })

  await t.test('resolveNaptr', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const records = await dns.promises.resolveNaptr('example.com')
      assert.equal(records.length, 1)
      assert.equal(records[0].replacement, '_sip._udp.example.com')
      verifySegments({ agent, name: 'dns.resolveNaptr', assertCallbacks: false })
    })
  })

  await t.test('resolveNs', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const names = await dns.promises.resolveNs('example.com')
      assert.deepEqual(names.sort(), ['a.iana-servers.net', 'b.iana-servers.net'])
      verifySegments({ agent, name: 'dns.resolveNs', assertCallbacks: false })
    })
  })

  await t.test('resolvePtr', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const names = await dns.promises.resolvePtr('example.com')
      assert.deepEqual(names, ['localhost'])
      verifySegments({ agent, name: 'dns.resolvePtr', assertCallbacks: false })
    })
  })

  await t.test('resolveSoa', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const soa = await dns.promises.resolveSoa('example.com')
      assert.equal(soa.nsname, 'ns.example.com')
      assert.equal(soa.hostmaster, 'root.example.com')
      verifySegments({ agent, name: 'dns.resolveSoa', assertCallbacks: false })
    })
  })

  await t.test('resolveTlsa', { skip: skipTlsa }, async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const records = await dns.promises.resolveTlsa('example.com')
      assert.equal(records.length, 1)
      assert.equal(records[0].certUsage, 3)
      verifySegments({ agent, name: 'dns.resolveTlsa', assertCallbacks: false })
    })
  })

  await t.test('resolveTxt', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const data = await dns.promises.resolveTxt('example.com')
      assert.deepEqual(data, ['one', 'two', 'three'])
      verifySegments({ agent, name: 'dns.resolveTxt', assertCallbacks: false })
    })
  })

  await t.test('resolveSrv', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      await assert.rejects(() => dns.promises.resolveSrv('example.com'))
      verifySegments({ agent, name: 'dns.resolveSrv', assertCallbacks: false })
    })
  })

  await t.test('reverse', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function () {
      const names = await dns.promises.reverse('127.0.0.1')
      assert.equal(names.length, 1)
      assert.equal(names[0], 'localhost')
      verifySegments({ agent, name: 'dns.reverse', assertCallbacks: false })
    })
  })
})

test('Resolver', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('resolve', function (t, end) {
    const { agent } = t.nr
    const resolver = new dns.Resolver()
    helper.runInTransaction(agent, function () {
      resolver.resolve('example.com', function (err, ips) {
        assert.ok(!err, 'should not error')
        assert.equal(ips.length, 1)
        assert.equal(ips[0], '127.0.0.1')

        verifySegments({ agent, end, name: 'dns.resolve', assertCallbacks: false })
      })
    })
  })

  await t.test('resolve4', function (t, end) {
    const { agent } = t.nr
    const resolver = new dns.Resolver()
    helper.runInTransaction(agent, function () {
      resolver.resolve4('example.com', function (err, ips) {
        assert.ok(!err, 'should not error')
        assert.equal(ips.length, 1)
        assert.equal(ips[0], '127.0.0.1')
        verifySegments({ agent, end, name: 'dns.resolve4', assertCallbacks: false })
      })
    })
  })

  await t.test('resolveSoa', function (t, end) {
    const { agent } = t.nr
    const resolver = new dns.Resolver()
    helper.runInTransaction(agent, function () {
      resolver.resolveSoa('example.com', function (err, soa) {
        assert.ok(!err, 'should not error')
        assert.equal(soa.nsname, 'ns.example.com')
        assert.equal(soa.hostmaster, 'root.example.com')
        verifySegments({ agent, end, name: 'dns.resolveSoa', assertCallbacks: false })
      })
    })
  })

  await t.test('reverse', function (t, end) {
    const { agent } = t.nr
    const resolver = new dns.Resolver()
    helper.runInTransaction(agent, function () {
      resolver.reverse('127.0.0.1', function (err, names) {
        assert.ok(!err, 'should not error')
        assert.equal(names.length, 1)
        assert.equal(names[0], 'localhost')
        verifySegments({ agent, end, name: 'dns.reverse', assertCallbacks: false })
      })
    })
  })
})

test('promises.Resolver', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('resolve', async function (t) {
    const { agent } = t.nr
    const resolver = new dns.promises.Resolver()
    await helper.runInTransaction(agent, async function () {
      const ips = await resolver.resolve('example.com')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '127.0.0.1')

      verifySegments({ agent, name: 'dns.resolve', assertCallbacks: false })
    })
  })

  await t.test('resolve4', async function (t) {
    const { agent } = t.nr
    const resolver = new dns.promises.Resolver()
    await helper.runInTransaction(agent, async function () {
      const ips = await resolver.resolve4('example.com')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '127.0.0.1')
      verifySegments({ agent, name: 'dns.resolve4', assertCallbacks: false })
    })
  })

  await t.test('resolveSoa', async function (t) {
    const { agent } = t.nr
    const resolver = new dns.promises.Resolver()
    await helper.runInTransaction(agent, async function () {
      const soa = await resolver.resolveSoa('example.com')
      assert.equal(soa.nsname, 'ns.example.com')
      assert.equal(soa.hostmaster, 'root.example.com')
      verifySegments({ agent, name: 'dns.resolveSoa', assertCallbacks: false })
    })
  })

  await t.test('reverse', async function (t) {
    const { agent } = t.nr
    const resolver = new dns.promises.Resolver()
    await helper.runInTransaction(agent, async function () {
      const names = await resolver.reverse('127.0.0.1')
      assert.equal(names.length, 1)
      assert.equal(names[0], 'localhost')
      verifySegments({ agent, name: 'dns.reverse', assertCallbacks: false })
    })
  })
})
