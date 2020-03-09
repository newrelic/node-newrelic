'use strict'

var test = require('tap').test
var cp = require('child_process')
var fs = require('fs')
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify.js')

test('exec', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    cp.exec('ls', {cwd: __dirname}, function(err, stdout, stderr) {
      t.notOk(err, 'should not error')
      var files = stdout.trim().split('\n').sort()
      t.deepEqual(files, fs.readdirSync(__dirname).sort())
      t.equal(stderr, '')
      verifySegments(t, agent, 'child_process.exec', ['child_process.execFile'])
    })
  })
})

test('execFile', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    cp.execFile('./exec-me.js', {cwd: __dirname}, function(err, stdout, stderr) {
      t.notOk(err, 'should not error')
      t.equal(stdout, 'I am stdout\n')
      t.equal(stderr, 'I am stderr\n')
      verifySegments(t, agent, 'child_process.execFile')
    })
  })
})

test('transaction context is preserved in subscribed events', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(transaction) {
    var child = cp.fork('./exec-me.js', {cwd: __dirname})

    child.on('message', function() {
      t.equal(agent.tracer.getTransaction(), transaction)
    })

    child.on('exit', function() {
      t.equal(agent.tracer.getTransaction(), transaction)
      t.end()
    })
  })
})

test('should not break removeListener', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function() {
    const child = cp.fork('./exec-me.js', {cwd: __dirname})

    function onMessage() {}

    child.on('message', onMessage)
    t.ok(child._events.message)

    child.removeListener('message', onMessage)
    t.notOk(child._events.message)

    child.on('exit', function() {
      t.end()
    })
  })
})

test('should not break once() removal of listener', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function() {
    const child = cp.fork('./exec-me.js', {cwd: __dirname})

    let invokedMessage = false
    child.once('message', function onMessage() {
      invokedMessage = true
      t.notOk(child._events.message)
    })

    child.on('exit', function() {
      t.ok(invokedMessage, 'Must have onMessage called for test to be valid.')
      t.end()
    })
  })
})

test('should not break removeAllListeners', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function() {
    const child = cp.fork('./exec-me.js', {cwd: __dirname})

    function onMessage() {}

    child.on('message', onMessage)
    t.ok(child._events.message)

    child.removeAllListeners('message')
    t.notOk(child._events.message)

    child.on('exit', function() {
      t.end()
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
