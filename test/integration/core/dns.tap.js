'use strict'

var test = require('tap').test
var dns = require('dns')
var helper = require('../../lib/agent_helper')
var semver = require('semver')


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
    dns.resolveMx('example.com', function(err) {
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
      if (process.env.TRAVIS && names.length > 0) {
        t.deepEqual(names, [
          "nettuno",
          "travis",
          "vagrant"
        ])
      } else {
        t.deepEqual(names, [])
      }
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

function verifySegments(t, agent, name, extras) {
  extras = extras || []
  var tx = agent.getTransaction()
  var root = agent.getTransaction().trace.root

  agent.once('transactionFinished', function() {
    t.equal(root.children.length, 1, 'should have a single child')

    var child = root.children[0]
    t.equal(child.name, name, 'child segment should have correct name')
    t.ok(child.timer.touched, 'child should started and ended')
    t.equal(
      child.children.length, extras.length,
      'child should have only expected children'
    )

    for (var i = 0; i < child.children.length; ++i) {
      t.equal(child.children[i].name, extras[i], 'grandchild should be as expected')
    }

    t.end()
  })

  process.nextTick(function() {
    tx.end()
  })
}
