/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const zlib = require('zlib')
const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify')
const concat = require('concat-stream')

// Prepare our data values. Note that since the agent isn't loaded yet these
// compressions are immune to agent fiddling.
const CONTENT = 'some content'
const DEFLATED_CONTENT = zlib.deflateSync(CONTENT).toString('base64')
const DEFLATED_RAW = zlib.deflateRawSync(CONTENT).toString('base64')
const GZIP_CONTENT = zlib.gzipSync(CONTENT).toString('base64')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('deflate', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    zlib.deflate(CONTENT, function (err, data) {
      assert.ok(!err, 'should not error')
      assert.equal(data.toString('base64'), DEFLATED_CONTENT)
      verifySegments({ agent, end, name: 'zlib.deflate' })
    })
  })
})

test('deflateRaw', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    zlib.deflateRaw(CONTENT, function (err, data) {
      assert.ok(!err, 'should not error')
      assert.equal(data.toString('base64'), DEFLATED_RAW)
      verifySegments({ agent, end, name: 'zlib.deflateRaw' })
    })
  })
})

test('gzip', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    zlib.gzip(CONTENT, function (err, data) {
      assert.ok(!err, 'should not error')
      assert.equal(data.toString('base64'), GZIP_CONTENT)
      verifySegments({ agent, end, name: 'zlib.gzip' })
    })
  })
})

test('inflate', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    zlib.inflate(Buffer.from(DEFLATED_CONTENT, 'base64'), function (err, data) {
      assert.ok(!err, 'should not error')
      assert.equal(data.toString(), CONTENT)
      verifySegments({ agent, end, name: 'zlib.inflate' })
    })
  })
})

test('inflateRaw', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    zlib.inflateRaw(Buffer.from(DEFLATED_RAW, 'base64'), function (err, data) {
      assert.ok(!err, 'should not error')
      assert.equal(data.toString(), CONTENT)
      verifySegments({ agent, end, name: 'zlib.inflateRaw' })
    })
  })
})

test('gunzip', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    zlib.gunzip(Buffer.from(GZIP_CONTENT, 'base64'), function (err, data) {
      assert.ok(!err, 'should not error')
      assert.equal(data.toString(), CONTENT)
      verifySegments({ agent, end, name: 'zlib.gunzip' })
    })
  })
})

test('unzip', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    zlib.unzip(Buffer.from(GZIP_CONTENT, 'base64'), function (err, data) {
      assert.ok(!err, 'should not error')
      assert.equal(data.toString(), CONTENT)
      verifySegments({ agent, end, name: 'zlib.unzip' })
    })
  })
})

test('createGzip', function (t, end) {
  const { agent } = t.nr
  testStream({ agent, end, method: 'createGzip', src: CONTENT, out: GZIP_CONTENT })
})

test('createGunzip', function (t, end) {
  const { agent } = t.nr
  testStream({
    agent,
    end,
    method: 'createGunzip',
    src: Buffer.from(GZIP_CONTENT, 'base64'),
    out: Buffer.from(CONTENT).toString('base64')
  })
})

test('createUnzip', function (t, end) {
  const { agent } = t.nr
  testStream({
    agent,
    end,
    method: 'createUnzip',
    src: Buffer.from(GZIP_CONTENT, 'base64'),
    out: Buffer.from(CONTENT).toString('base64')
  })
})

test('createDeflate', function (t, end) {
  const { agent } = t.nr
  testStream({ agent, end, method: 'createDeflate', src: CONTENT, out: DEFLATED_CONTENT })
})

test('createInflate', function (t, end) {
  const { agent } = t.nr
  testStream({
    agent,
    end,
    method: 'createInflate',
    src: Buffer.from(DEFLATED_CONTENT, 'base64'),
    out: Buffer.from(CONTENT).toString('base64')
  })
})

test('createDeflateRaw', function (t, end) {
  const { agent } = t.nr
  testStream({ agent, end, method: 'createDeflateRaw', src: CONTENT, out: DEFLATED_RAW })
})

test('createInflateRaw', function (t, end) {
  const { agent } = t.nr
  testStream({
    agent,
    end,
    method: 'createInflateRaw',
    src: Buffer.from(DEFLATED_RAW, 'base64'),
    out: Buffer.from(CONTENT).toString('base64')
  })
})

test('recorded method still ends segment and binds callback on error', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    // gunzip on non-gzip data errors.
    zlib.gunzip(Buffer.from('not gzip data'), function (err) {
      assert.ok(err, 'should error on invalid input')
      assert.equal(agent.getTransaction(), transaction, 'callback should run in transaction')

      const { trace } = transaction
      const traceChildren = trace.getChildren(trace.root.id)
      assert.equal(traceChildren.length, 1, 'should have a single child')
      const child = traceChildren[0]
      assert.equal(child.name, 'zlib.gunzip', 'child segment should have correct name')
      assert.ok(child.timer.touched, 'child should have started and ended')
      end()
    })
  })
})

test('stream preserves transaction context in its own event handlers', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const stream = zlib.createGzip()

    // The zlib stream classes do not create their own segments, but the active
    // transaction must still propagate across the stream's internal async
    // callbacks. Assert the transaction survives into the stream's own async
    // event handlers.
    stream.on('data', function () {
      assert.equal(
        agent.getTransaction(),
        transaction,
        'transaction should be active in data handler'
      )
    })

    stream.on('end', function () {
      assert.equal(
        agent.getTransaction(),
        transaction,
        'transaction should be active in end handler'
      )
      end()
    })

    stream.on('error', function (err) {
      assert.ok(!err, 'should not error')
      end()
    })

    stream.end(CONTENT)
    stream.resume()
  })
})

test('stream works outside of a transaction', function (t, end) {
  const { agent } = t.nr
  // No runInTransaction wrapper -- zlib streams must work normally when there
  // is no active transaction.
  assert.equal(agent.getTransaction(), null, 'precondition: no active transaction')

  const concatStream = concat(function (result) {
    assert.equal(result.toString('base64'), GZIP_CONTENT, 'should have correct result')
    assert.equal(agent.getTransaction(), null, 'should still have no transaction')
    end()
  })

  const stream = zlib.createGzip()
  stream.pipe(concatStream)
  stream.end(CONTENT)
})

function testStream({ agent, end, method, src, out }) {
  helper.runInTransaction(agent, function (transaction) {
    const concatStream = concat(check)

    // The check callback is called when the stream finishes.
    const stream = zlib[method]()
    stream.pipe(concatStream)
    stream.end(src)

    function check(result) {
      assert.equal(result.toString('base64'), out, 'should have correct result')
      assert.equal(agent.getTransaction(), transaction)
      end()
    }
  })
}
