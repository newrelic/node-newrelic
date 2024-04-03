/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const dns = require('dns')
const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify.js')

test('lookup - IPv4', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.lookup('localhost', { verbatim: false }, function (err, ip, v) {
      t.notOk(err, 'should not error')
      t.equal(ip, '127.0.0.1')
      t.equal(v, 4)
      verifySegments(t, agent, 'dns.lookup')
    })
  })
})

test('lookup - IPv6', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    // Verbatim defaults to true in Node 18+
    dns.lookup('localhost', { verbatim: true }, function (err, ip, v) {
      t.notOk(err, 'should not error')
      t.equal(ip, '::1')
      t.equal(v, 6)
      verifySegments(t, agent, 'dns.lookup')
    })
  })
})

test('resolve', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.resolve('example.com', function (err, ips) {
      t.notOk(err, 'should not error')
      t.equal(ips.length, 1)
      t.ok(ips[0].match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/))

      const children = []
      verifySegments(t, agent, 'dns.resolve', children)
    })
  })
})

test('resolve4', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.resolve4('example.com', function (err, ips) {
      t.notOk(err, 'should not error')
      t.equal(ips.length, 1)
      t.ok(ips[0].match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/))
      verifySegments(t, agent, 'dns.resolve4')
    })
  })
})

test('resolve6', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.resolve6('example.com', function (err, ips) {
      t.notOk(err, 'should not error')
      t.equal(ips.length, 1)
      t.ok(ips[0].match(/^(([0-9a-f]{1,4})(\:|$)){8}/))
      verifySegments(t, agent, 'dns.resolve6')
    })
  })
})

test('resolveCname', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.resolveCname('example.com', function (err) {
      t.equal(err.code, 'ENODATA')
      verifySegments(t, agent, 'dns.resolveCname')
    })
  })
})

test('resolveMx', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.resolveMx('example.com', function (err, ips) {
      t.notOk(err)
      t.equal(ips.length, 1)

      verifySegments(t, agent, 'dns.resolveMx')
    })
  })
})

test('resolveNs', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.resolveNs('example.com', function (err, names) {
      t.notOk(err, 'should not error')
      t.same(names.sort(), ['a.iana-servers.net', 'b.iana-servers.net'])
      verifySegments(t, agent, 'dns.resolveNs')
    })
  })
})

test('resolveTxt', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.resolveTxt('example.com', function (err, data) {
      t.notOk(err)
      t.ok(Array.isArray(data))
      verifySegments(t, agent, 'dns.resolveTxt')
    })
  })
})

test('resolveSrv', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.resolveSrv('example.com', function (err) {
      t.equal(err.code, 'ENODATA')
      verifySegments(t, agent, 'dns.resolveSrv')
    })
  })
})

test('reverse', function (t) {
  const reverse = dns.reverse
  dns.reverse = (addr, cb) => {
    cb(undefined, ['localhost'])
  }
  t.teardown(() => {
    dns.reverse = reverse
  })

  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    dns.reverse('127.0.0.1', function (err, names) {
      t.error(err, 'should not error')
      t.not(names.indexOf('localhost'), -1, 'should have expected name')
      verifySegments(t, agent, 'dns.reverse')
    })
  })
})

function setupAgent(t) {
  const agent = helper.instrumentMockedAgent()
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  return agent
}
