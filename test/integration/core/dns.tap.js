/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var test = require('tap').test
var dns = require('dns')
var helper = require('../../lib/agent_helper')
var semver = require('semver')
var verifySegments = require('./verify.js')

test('lookup', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    dns.lookup('localhost', function(err, ip, v) {
      t.notOk(err, 'should not error')
      t.equal(ip, '127.0.0.1')
      t.equal(v, 4)
      verifySegments(t, agent, 'dns.lookup')
    })
  })
})

test('resolve', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    dns.resolve('example.com', function(err, ips) {
      t.notOk(err, 'should not error')
      t.equal(ips.length, 1)
      t.ok(ips[0].match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/))

      var children =
        semver.satisfies(process.version, '>=7.7.2') ? [] : ['dns.resolve4']

      verifySegments(t, agent, 'dns.resolve', children)
    })
  })
})

test('resolve4', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    dns.resolve4('example.com', function(err, ips) {
      t.notOk(err, 'should not error')
      t.equal(ips.length, 1)
      t.ok(ips[0].match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/))
      verifySegments(t, agent, 'dns.resolve4')
    })
  })
})

test('resolve6', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    dns.resolve6('example.com', function(err, ips) {
      t.notOk(err, 'should not error')
      t.equal(ips.length, 1)
      t.ok(ips[0].match(/^(([0-9a-f]{1,4})(\:|$)){8}/))
      verifySegments(t, agent, 'dns.resolve6')
    })
  })
})

test('resolveCname', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    dns.resolveCname('example.com', function(err) {
      t.equal(err.code, 'ENODATA')
      verifySegments(t, agent, 'dns.resolveCname')
    })
  })
})

test('resolveMx', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    // If this test breaks, blame Natalie Wolfe for adding a mailing
    // service to encryptic.io
    dns.resolveMx('encryptic.io', function(err) {
      t.equal(err.code, 'ENODATA')
      verifySegments(t, agent, 'dns.resolveMx')
    })
  })
})

test('resolveNs', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    dns.resolveNs('example.com', function(err, names) {
      t.notOk(err, 'should not error')
      t.deepEqual(names.sort(), ['a.iana-servers.net', 'b.iana-servers.net'])
      verifySegments(t, agent, 'dns.resolveNs')
    })
  })
})

test('resolveTxt', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    dns.resolveTxt('example.com', function(err, data) {
      t.notOk(err)
      t.ok(Array.isArray(data))
      verifySegments(t, agent, 'dns.resolveTxt')
    })
  })
})

test('resolveSrv', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    dns.resolveSrv('example.com', function(err) {
      t.equal(err.code, 'ENODATA')
      verifySegments(t, agent, 'dns.resolveSrv')
    })
  })
})

test('reverse', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    dns.reverse('127.0.0.1', function(err, names) {
      t.notOk(err, 'should not error')
      var expected = []
      if (process.env.TRAVIS && names.length > 0) {
        if (process.env.DOCKERIZED) {
          if (names.length === 2) {
            expected = ['127.0.0.1', 'localhost']
          } else {
            expected = ['localhost']
          }
        } else {
          expected = ['nettuno', 'travis', 'vagrant']
        }
      }

      expected.forEach((name) => {
        t.notEqual(names.indexOf(name), -1, 'should have expected name')
      })
      verifySegments(t, agent, 'dns.reverse')
    })
  })
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  return agent
}
