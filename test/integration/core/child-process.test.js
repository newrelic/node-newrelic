/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const cp = require('child_process')
const fs = require('fs')
const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify.js')
const symbols = require('../../../lib/symbols')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('exec', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    cp.exec('ls', { cwd: __dirname }, function (err, stdout, stderr) {
      assert.ok(!err, 'should not error')
      const files = stdout.trim().split('\n').sort()
      assert.deepEqual(files, fs.readdirSync(__dirname).sort())
      assert.equal(stderr, '')
      verifySegments({
        agent,
        end,
        name: 'child_process.exec',
        children: ['child_process.execFile']
      })
    })
  })
})

test('execFile', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    cp.execFile('./exec-me.js', { cwd: __dirname }, function (err, stdout, stderr) {
      assert.ok(!err, 'should not error')
      assert.equal(stdout, 'I am stdout\n')
      assert.equal(stderr, 'I am stderr\n')
      verifySegments({ agent, end, name: 'child_process.execFile' })
    })
  })
})

test('transaction context is preserved in subscribed events', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    child.on('message', function () {
      assert.equal(agent.tracer.getTransaction(), transaction)
    })

    child.on('exit', function () {
      assert.equal(agent.tracer.getTransaction(), transaction)
      end()
    })
  })
})

test('should not break removeListener for single event', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    function onMessage() {}

    child.on('message', onMessage)
    assert.ok(child._events.message)

    child.removeListener('message', onMessage)
    assert.ok(!child._events.message)

    child.on('exit', function () {
      end()
    })
  })
})

test('should not break removeListener for multiple events down to single', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    function onMessage() {}
    function onMessage2() {}

    child.on('message', onMessage)
    child.on('message', onMessage2)
    assert.ok(child._events.message)

    child.removeListener('message', onMessage)
    assert.ok(child._events.message)
    assert.equal(child._events.message[symbols.original], onMessage2)

    child.on('exit', function () {
      end()
    })
  })
})

test('should not break removeListener for multiple events down to multiple', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    function onMessage() {}
    function onMessage2() {}
    function onMessage3() {}

    child.on('message', onMessage)
    child.on('message', onMessage2)
    child.on('message', onMessage3)
    assert.ok(child._events.message)

    child.removeListener('message', onMessage)
    assert.ok(child._events.message)
    assert.equal(child._events.message.length, 2)

    child.on('exit', function () {
      end()
    })
  })
})

test('should not break once() removal of listener', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    let invokedMessage = false
    child.once('message', function onMessage() {
      invokedMessage = true
      assert.ok(!child._events.message)
    })

    child.on('exit', function () {
      assert.ok(invokedMessage, 'Must have onMessage called for test to be valid.')
      end()
    })
  })
})

test('should not break multiple once() for multiple events down to single', (t, end) => {
  const { agent } = t.nr

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
      assert.ok(invokedMessage1, 'Must have onMessage called for test to be valid.')
      assert.ok(invokedMessage2, 'Must have onMessage2 called for test to be valid.')

      assert.equal(child._events.message[symbols.original], onMessage3)
      end()
    })
  })
})

test('should not break multiple once() for multiple events down to multiple', (t, end) => {
  const { agent } = t.nr

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
      assert.ok(invokedMessage1, 'Must have onMessage called for test to be valid.')
      assert.ok(invokedMessage2, 'Must have onMessage2 called for test to be valid.')

      assert.ok(child._events.message)
      assert.equal(child._events.message.length, 2)

      end()
    })
  })
})

// Don't expect this should be possible but lets protect ourselves anyways.
test('should not break removal of non-wrapped listener', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    // Avoid our instrumentation via private method.
    // TODO: should we also be instrumenting addListener?
    function nonWrappedListener() {}
    child.addListener('message', nonWrappedListener)

    child.removeListener('message', nonWrappedListener)
    assert.ok(!child._events.message)

    child.on('exit', function () {
      end()
    })
  })
})

// Don't expect this should be possible but lets protect ourselves anyways.
test('should not break when non-wrapped listener exists', (t, end) => {
  const { agent } = t.nr

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
      assert.ok(invokedMessage, 'Must have onMessage called for test to be valid.')

      assert.ok(child._events.message)
      assert.equal(child._events.message, nonWrappedListener)

      end()
    })
  })
})

test('should not introduce a new error nor hide error for missing handler', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    try {
      child.on('message', null)
    } catch (error) {
      assert.ok(error)
      assert.ok(error.message.includes('"listener" argument must be'))
    }

    child.on('exit', function () {
      end()
    })
  })
})

test('should not introduce a new error nor hide error for invalid handler', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    try {
      child.on('message', 1)
    } catch (error) {
      assert.ok(error)
      assert.ok(error.message.includes('"listener" argument must be'))
    }

    child.on('exit', function () {
      end()
    })
  })
})

test('should not break removeAllListeners', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    function onMessage() {}

    child.on('message', onMessage)
    assert.ok(child._events.message)

    child.removeAllListeners('message')
    assert.ok(!child._events.message)

    child.on('exit', function () {
      end()
    })
  })
})
