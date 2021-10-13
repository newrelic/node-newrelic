/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const cp = require('child_process')
const fs = require('fs')
const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify.js')

test('exec', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    cp.exec('ls', { cwd: __dirname }, function (err, stdout, stderr) {
      t.notOk(err, 'should not error')
      const files = stdout.trim().split('\n').sort()
      t.same(files, fs.readdirSync(__dirname).sort())
      t.equal(stderr, '')
      verifySegments(t, agent, 'child_process.exec', ['child_process.execFile'])
    })
  })
})

test('execFile', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    cp.execFile('./exec-me.js', { cwd: __dirname }, function (err, stdout, stderr) {
      t.notOk(err, 'should not error')
      t.equal(stdout, 'I am stdout\n')
      t.equal(stderr, 'I am stderr\n')
      verifySegments(t, agent, 'child_process.execFile')
    })
  })
})

test('transaction context is preserved in subscribed events', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    child.on('message', function () {
      t.equal(agent.tracer.getTransaction(), transaction)
    })

    child.on('exit', function () {
      t.equal(agent.tracer.getTransaction(), transaction)
      t.end()
    })
  })
})

test('should not break removeListener for single event', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    function onMessage() {}

    child.on('message', onMessage)
    t.ok(child._events.message)

    child.removeListener('message', onMessage)
    t.notOk(child._events.message)

    child.on('exit', function () {
      t.end()
    })
  })
})

test('should not break removeListener for multiple events down to single', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    function onMessage() {}
    function onMessage2() {}

    child.on('message', onMessage)
    child.on('message', onMessage2)
    t.ok(child._events.message)

    child.removeListener('message', onMessage)
    t.ok(child._events.message)
    t.equal(child._events.message.__NR_original, onMessage2)

    child.on('exit', function () {
      t.end()
    })
  })
})

test('should not break removeListener for multiple events down to multiple', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    function onMessage() {}
    function onMessage2() {}
    function onMessage3() {}

    child.on('message', onMessage)
    child.on('message', onMessage2)
    child.on('message', onMessage3)
    t.ok(child._events.message)

    child.removeListener('message', onMessage)
    t.ok(child._events.message)
    t.equal(child._events.message.length, 2)

    child.on('exit', function () {
      t.end()
    })
  })
})

test('should not break once() removal of listener', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    let invokedMessage = false
    child.once('message', function onMessage() {
      invokedMessage = true
      t.notOk(child._events.message)
    })

    child.on('exit', function () {
      t.ok(invokedMessage, 'Must have onMessage called for test to be valid.')
      t.end()
    })
  })
})

test('should not break multiple once() for multiple events down to single', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    let invokedMessage1 = false
    let invokedMessage2 = false
    child.once('message', function onMessage() {
      invokedMessage1 = true
    })

    child.once('message', function onMessage2() {
      invokedMessage2 = true
    })

    function onMessage3() {}
    child.on('message', onMessage3)

    child.on('exit', function () {
      t.ok(invokedMessage1, 'Must have onMessage called for test to be valid.')
      t.ok(invokedMessage2, 'Must have onMessage2 called for test to be valid.')

      t.equal(child._events.message.__NR_original, onMessage3)
      t.end()
    })
  })
})

test('should not break multiple once() for multiple events down to multiple', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    let invokedMessage1 = false
    let invokedMessage2 = false
    child.once('message', function onMessage() {
      invokedMessage1 = true
    })

    child.once('message', function onMessage2() {
      invokedMessage2 = true
    })

    child.on('message', function onMessage3() {})
    child.on('message', function onMessage4() {})

    child.on('exit', function () {
      t.ok(invokedMessage1, 'Must have onMessage called for test to be valid.')
      t.ok(invokedMessage2, 'Must have onMessage2 called for test to be valid.')

      t.ok(child._events.message)
      t.equal(child._events.message.length, 2)

      t.end()
    })
  })
})

// Don't expect this should be possible but lets protect ourselves anyways.
test('should not break removal of non-wrapped listener', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    // Avoid our instrumentation via private method.
    // TODO: should we also be instrumenting addListener?
    function nonWrappedListener() {}
    child.addListener('message', nonWrappedListener)

    child.removeListener('message', nonWrappedListener)
    t.notOk(child._events.message)

    child.on('exit', function () {
      t.end()
    })
  })
})

// Don't expect this should be possible but lets protect ourselves anyways.
test('should not break when non-wrapped listener exists', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    let invokedMessage = false
    child.once('message', function onMessage() {
      invokedMessage = true
    })

    // Avoid our instrumentation via private method.
    function nonWrappedListener() {}
    child.addListener('message', nonWrappedListener)

    child.on('exit', function () {
      t.ok(invokedMessage, 'Must have onMessage called for test to be valid.')

      t.ok(child._events.message)
      t.equal(child._events.message, nonWrappedListener)

      t.end()
    })
  })
})

test('should not introduce a new error nor hide error for missing handler', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    try {
      child.on('message', null)
    } catch (error) {
      t.ok(error)
      t.ok(error.message.includes('"listener" argument must be'))
    }

    child.on('exit', function () {
      t.end()
    })
  })
})

test('should not introduce a new error nor hide error for invalid handler', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    try {
      child.on('message', 1)
    } catch (error) {
      t.ok(error)
      t.ok(error.message.includes('"listener" argument must be'))
    }

    child.on('exit', function () {
      t.end()
    })
  })
})

test('should not break removeAllListeners', (t) => {
  const agent = setupAgent(t)

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    function onMessage() {}

    child.on('message', onMessage)
    t.ok(child._events.message)

    child.removeAllListeners('message')
    t.notOk(child._events.message)

    child.on('exit', function () {
      t.end()
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
