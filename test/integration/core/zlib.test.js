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
