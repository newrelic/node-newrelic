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

test('resolveCname', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolveCname('example.com', function (err) {
      assert.equal(err.code, 'ENODATA')
      verifySegments({ agent, end, name: 'dns.resolveCname' })
    })
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

test('resolveSrv', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    dns.resolveSrv('example.com', function (err) {
      assert.equal(err.code, 'ENODATA')
      verifySegments({ agent, end, name: 'dns.resolveSrv' })
    })
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
