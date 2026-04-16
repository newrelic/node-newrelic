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

    child.on('message', function (data) {
      assert.equal(data, 'hello')
      assert.equal(agent.tracer.getTransaction(), transaction)
    })

    child.on('exit', function () {
      assert.equal(agent.tracer.getTransaction(), transaction)
      end()
    })
  })
})

test('transaction context is preserved in subscribed events with `once`', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    child.once('message', function (data) {
      assert.equal(data, 'hello')
      assert.equal(agent.tracer.getTransaction(), transaction)
    })

    child.once('exit', function () {
      assert.equal(agent.tracer.getTransaction(), transaction)
      end()
    })
  })
})

;['removeListener', 'off'].forEach((method) => {
  test(`should not break ${method} for single event`, (t, end) => {
    const { agent } = t.nr

    helper.runInTransaction(agent, function () {
      const child = cp.fork('./exec-me.js', { cwd: __dirname })

      function onMessage() {}

      child.on('message', onMessage)
      assert.equal(child._events.message, onMessage)

      child[method]('message', onMessage)
      assert.ok(!child._events.message)

      child.on('exit', function () {
        end()
      })
    })
  })

  test(`should not break ${method} for single event not called`, (t, end) => {
    const { agent } = t.nr

    helper.runInTransaction(agent, function () {
      const child = cp.fork('./exec-me.js', { cwd: __dirname })

      function onMessage() {}
      function onError() {}

      child.on('message', onMessage)
      child.on('error', onError)
      assert.equal(child._events.message, onMessage)
      assert.equal(child._events.error, onError)

      child[method]('message', onMessage)
      assert.ok(!child._events.message)
      child[method]('error', onError)
      assert.ok(!child._events.error)

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
      assert.equal(child._events.message.length, 2)

      child[method]('message', onMessage)
      assert.equal(child._events.message, onMessage2)

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
      assert.equal(child._events.message.length, 3)

      child[method]('message', onMessage)
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
      function onMessage() {
        invokedMessage = true
      }
      child.once('message', onMessage)
      child[method]('message', onMessage)

      child.on('exit', function () {
        assert.ok(!invokedMessage, 'onMessage should not have been called')
        assert.ok(!child._events.message)
        end()
      })
    })
  })

  test('should not break once() removal of listener not fired', (t, end) => {
    const { agent } = t.nr

    helper.runInTransaction(agent, function () {
      const child = cp.fork('./exec-me.js', { cwd: __dirname })

      let invokedMessage = false
      function onMessage() {
        invokedMessage = true
      }

      let invokedError = false
      function onError() {
        invokedError = true
      }
      child.once('message', onMessage)
      child.once('error', onError)
      child[method]('message', onMessage)
      child[method]('error', onError)

      child.on('exit', function () {
        assert.ok(!invokedMessage, 'onMessage should not have been called')
        assert.ok(!invokedError, 'onError should not have been called')
        assert.ok(!child._events.message)
        assert.ok(!child._events.error)
        end()
      })
    })
  })

  test(`should not affect calling ${method} on() when transaction is not active`, (t, end) => {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    let invokedMessage = false
    function onMessage() {
      invokedMessage = true
    }
    child.on('message', onMessage)
    child[method]('message', onMessage)

    child.on('exit', function () {
      assert.ok(!invokedMessage, 'onMessage should not have been called')
      assert.ok(!child._events.message)
      end()
    })
  })

  test(`should not affect calling ${method} once() when transaction is not active`, (t, end) => {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    let invokedMessage = false
    function onMessage() {
      invokedMessage = true
    }
    child.once('message', onMessage)
    child[method]('message', onMessage)

    child.on('exit', function () {
      assert.ok(!invokedMessage, 'onMessage should not have been called')
      assert.ok(!child._events.message)
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

test('should not break once() removal of listener not an active tx', (t, end) => {
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

      assert.equal(child._events.message, onMessage3)
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

test('should not break removal of listener added via `addListener`', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    function nonWrappedListener() {}
    child.addListener('message', nonWrappedListener)

    child.removeListener('message', nonWrappedListener)
    assert.ok(!child._events.message)

    child.on('exit', function () {
      end()
    })
  })
})

test('should not break when listener exists added via `addListener`', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function (transaction) {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    let invokedMessage = false
    child.once('message', function onMessage() {
      invokedMessage = true
    })

    function nonWrappedListener() {
      assert.equal(agent.tracer.getTransaction(), transaction)
    }

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
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    try {
      child.on('message', null)
    } catch (error) {
      t.assert.ok(error)
      t.assert.ok(error.message.includes('"listener" argument must be'))
    }

    child.on('exit', function () {
      end()
    })
  })
})

test('should not introduce a new error nor hide error for invalid handler', (t, end) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    try {
      child.on('message', 1)
    } catch (error) {
      t.assert.ok(error)
      t.assert.ok(error.message.includes('"listener" argument must be'))
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

test('should not break removeAllListeners with `onceListeners`', (t, end) => {
  const { agent } = t.nr

  helper.runInTransaction(agent, function () {
    const child = cp.fork('./exec-me.js', { cwd: __dirname })

    let onMessageCalled = false
    function onMessage() {
      onMessageCalled = true
    }

    child.once('message', onMessage)
    assert.ok(child._events.message)

    child.removeAllListeners('message')
    assert.ok(!child._events.message)

    child.on('exit', function () {
      assert.ok(!onMessageCalled)
      end()
    })
  })
})
