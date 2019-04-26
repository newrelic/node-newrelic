'use strict'

var test = require('tap').test
var crypto = require('crypto')
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify.js')

test('pbkdf2', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    crypto.pbkdf2('hunter2', 'saltine', 5, 32, 'sha1', function(err, key) {
      t.notOk(err, 'should not error')
      t.equal(key.length, 32)
      verifySegments(t, agent, 'crypto.pbkdf2')
    })
  })
})

test('randomBytes', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    crypto.randomBytes(32, function(err, key) {
      t.notOk(err, 'should not error')
      t.ok(key.length, 32)
      verifySegments(t, agent, 'crypto.randomBytes')
    })
  })
})

test('sync randomBytes', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(transaction) {
    var bytes = crypto.randomBytes(32)
    t.ok(bytes instanceof Buffer)
    t.equal(bytes.length, 32)
    t.equal(transaction.trace.root.children.length, 0)
    t.end()
  })
})

test('pseudoRandomBytes', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    crypto.pseudoRandomBytes(32, function(err, key) {
      t.notOk(err, 'should not error')
      t.ok(key.length, 32)
      verifySegments(t, agent, 'crypto.pseudoRandomBytes')
    })
  })
})

test('sync pseudoRandomBytes', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(transaction) {
    var bytes = crypto.pseudoRandomBytes(32)
    t.ok(bytes instanceof Buffer)
    t.equal(bytes.length, 32)
    t.equal(transaction.trace.root.children.length, 0)
    t.end()
  })
})

test('randomFill', function(t) {
  if (!crypto.randomFill) {
    return t.end()
  }
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    var buf = Buffer.alloc(10)
    crypto.randomFill(buf, function(err, buffer) {
      t.notOk(err, 'should not error')
      t.ok(buffer.length, 10)
      verifySegments(t, agent, 'crypto.randomFill')
    })
  })
})

test('sync randomFill', function(t) {
  if (!crypto.randomFill) {
    return t.end()
  }
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(transaction) {
    var buf = Buffer.alloc(10)
    crypto.randomFillSync(buf)
    t.ok(buf instanceof Buffer)
    t.equal(buf.length, 10)
    t.equal(transaction.trace.root.children.length, 0)
    t.end()
  })
})

test('scrypt', (t) => {
  if (!crypto.scrypt) {
    return t.end()
  }
  const agent = setupAgent(t)
  helper.runInTransaction(agent, () => {
    crypto.scrypt('secret', 'salt', 10, (err, buf) => {
      t.notOk(err, 'should not error')
      t.ok(buf.length, 10)
      verifySegments(t, agent, 'crypto.scrypt')
    })
  })
})

test('scryptSync', (t) => {
  if (!crypto.scryptSync) {
    return t.end()
  }
  const agent = setupAgent(t)
  helper.runInTransaction(agent, (transaction) => {
    const buf = crypto.scryptSync('secret', 'salt', 10)
    t.ok(buf instanceof Buffer)
    t.equal(buf.length, 10)
    t.equal(transaction.trace.root.children.length, 0)
    t.end()
  })
})


function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  return agent
}
