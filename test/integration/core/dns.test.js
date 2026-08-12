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

test.beforeEach((ctx) => {
  const sandbox = sinon.createSandbox()
  ctx.nr = {}
  ctx.nr.sandbox = sandbox

  mockDns({ dns, sandbox })
  ctx.nr.agent = helper.instrumentMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.sandbox.restore()
})

test('lookup - IPv4', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.lookup('localhost', { verbatim: false }, function (err, ip, v) {
      assert.ok(!err, 'should not error')
      assert.equal(ip, '127.0.0.1')
      assert.equal(v, 4)
      verifySegments({ agent, end, name: 'dns.lookup' })
    })
  })
})

test('(promise)lookup - IPv4', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    const { address, family } = await dns.promises.lookup('localhost', { verbatim: false })
    assert.equal(address, '127.0.0.1')
    assert.equal(family, 4)
    verifySegments({ agent, name: 'dns.lookup', assertCallbacks: false })
  })
})

test('lookup - IPv6', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    // Verbatim defaults to true in Node 18+
    dns.lookup('localhost', { verbatim: true }, function (err, ip, v) {
      assert.ok(!err, 'should not error')
      assert.equal(ip, '::1')
      assert.equal(v, 6)
      verifySegments({ agent, end, name: 'dns.lookup' })
    })
  })
})

test('resolve', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolve('example.com', function (err, ips) {
      assert.ok(!err, 'should not error')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '127.0.0.1')

      verifySegments({ agent, end, name: 'dns.resolve' })
    })
  })
})

test('Resolver.resolve', function (t, end) {
  const { agent } = t.nr
  const resolver = new dns.Resolver()
  helper.runInTransaction(agent, function () {
    resolver.resolve('example.com', function (err, ips) {
      assert.ok(!err, 'should not error')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '127.0.0.1')

      verifySegments({ agent, end, name: 'dns.resolve' })
    })
  })
})

test('(promise)resolve', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    const ips = await dns.promises.resolve('example.com')
    assert.equal(ips.length, 1)
    assert.equal(ips[0], '127.0.0.1')

    verifySegments({ agent, name: 'dns.resolve', assertCallbacks: false })
  })
})

test('(promise) Resolver.resolve', async function (t) {
  const { agent } = t.nr
  const resolver = new dns.promises.Resolver()
  await helper.runInTransaction(agent, async function () {
    const ips = await resolver.resolve('example.com')
    assert.equal(ips.length, 1)
    assert.equal(ips[0], '127.0.0.1')

    verifySegments({ agent, name: 'dns.resolve', assertCallbacks: false })
  })
})

test('resolve4', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolve4('example.com', function (err, ips) {
      assert.ok(!err, 'should not error')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '127.0.0.1')
      verifySegments({ agent, end, name: 'dns.resolve4' })
    })
  })
})

test('(promise)resolve4', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    const ips = await dns.promises.resolve4('example.com')
    assert.equal(ips.length, 1)
    assert.equal(ips[0], '127.0.0.1')
    verifySegments({ agent, name: 'dns.resolve4', assertCallbacks: false })
  })
})

test('resolve6', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolve6('example.com', function (err, ips) {
      assert.ok(!err, 'should not error')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '::1')
      verifySegments({ agent, end, name: 'dns.resolve6' })
    })
  })
})

test('(promise)resolve6', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    const ips = await dns.promises.resolve6('example.com')
    assert.equal(ips.length, 1)
    assert.equal(ips[0], '::1')
    verifySegments({ agent, name: 'dns.resolve6', assertCallbacks: false })
  })
})

test('resolveCname', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolveCname('example.com', function (err) {
      assert.equal(err.code, 'ENODATA')
      verifySegments({ agent, end, name: 'dns.resolveCname' })
    })
  })
})

test('(promise)resolveCname', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    await assert.rejects(() => dns.promises.resolveCname('example.com'))
    verifySegments({ agent, name: 'dns.resolveCname', assertCallbacks: false })
  })
})

test('resolveMx', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolveMx('example.com', function (err, ips) {
      assert.ok(!err, 'should not error')
      assert.equal(ips.length, 1)
      assert.equal(ips[0], '127.0.0.1')

      verifySegments({ agent, end, name: 'dns.resolveMx' })
    })
  })
})

test('(promise)resolveMx', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    const ips = await dns.promises.resolveMx('example.com')
    assert.equal(ips.length, 1)
    assert.equal(ips[0], '127.0.0.1')
    verifySegments({ agent, name: 'dns.resolveMx', assertCallbacks: false })
  })
})

test('resolveNs', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolveNs('example.com', function (err, names) {
      assert.ok(!err, 'should not error')
      assert.deepEqual(names.sort(), ['a.iana-servers.net', 'b.iana-servers.net'])
      verifySegments({ agent, end, name: 'dns.resolveNs' })
    })
  })
})

test('(promise)resolveNs', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    const names = await dns.promises.resolveNs('example.com')
    assert.deepEqual(names.sort(), ['a.iana-servers.net', 'b.iana-servers.net'])
    verifySegments({ agent, name: 'dns.resolveNs', assertCallbacks: false })
  })
})

test('resolveTxt', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolveTxt('example.com', function (err, data) {
      assert.ok(!err, 'should not error')
      assert.deepEqual(data, ['one', 'two', 'three'])
      assert.ok(Array.isArray(data))
      verifySegments({ agent, end, name: 'dns.resolveTxt' })
    })
  })
})

test('(promise)resolveTxt', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    const data = await dns.promises.resolveTxt('example.com')
    assert.deepEqual(data, ['one', 'two', 'three'])
    verifySegments({ agent, name: 'dns.resolveTxt', assertCallbacks: false })
  })
})

test('resolveSrv', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolveSrv('example.com', function (err) {
      assert.equal(err.code, 'ENODATA')
      verifySegments({ agent, end, name: 'dns.resolveSrv' })
    })
  })
})

test('(promise)resolveSrv', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    await assert.rejects(() => dns.promises.resolveSrv('example.com'))
    verifySegments({ agent, name: 'dns.resolveSrv', assertCallbacks: false })
  })
})

test('reverse', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.reverse('127.0.0.1', function (err, names) {
      assert.ok(!err, 'should not error')
      assert.equal(names.length, 1)
      assert.equal(names[0], 'localhost')
      verifySegments({ agent, end, name: 'dns.reverse' })
    })
  })
})

test('(promise)reverse', async function (t) {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async function () {
    const names = await dns.promises.reverse('127.0.0.1')
    assert.equal(names.length, 1)
    assert.equal(names[0], 'localhost')
    verifySegments({ agent, name: 'dns.reverse', assertCallbacks: false })
  })
})
