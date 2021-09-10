/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
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

test('deflate', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    zlib.deflate(CONTENT, function (err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('base64'), DEFLATED_CONTENT)
      verifySegments(t, agent, 'zlib.deflate')
    })
  })
})

test('deflateRaw', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    zlib.deflateRaw(CONTENT, function (err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('base64'), DEFLATED_RAW)
      verifySegments(t, agent, 'zlib.deflateRaw')
    })
  })
})

test('gzip', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    zlib.gzip(CONTENT, function (err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString('base64'), GZIP_CONTENT)
      verifySegments(t, agent, 'zlib.gzip')
    })
  })
})

test('inflate', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    zlib.inflate(Buffer.from(DEFLATED_CONTENT, 'base64'), function (err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString(), CONTENT)
      verifySegments(t, agent, 'zlib.inflate')
    })
  })
})

test('inflateRaw', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    zlib.inflateRaw(Buffer.from(DEFLATED_RAW, 'base64'), function (err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString(), CONTENT)
      verifySegments(t, agent, 'zlib.inflateRaw')
    })
  })
})

test('gunzip', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    zlib.gunzip(Buffer.from(GZIP_CONTENT, 'base64'), function (err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString(), CONTENT)
      verifySegments(t, agent, 'zlib.gunzip')
    })
  })
})

test('unzip', function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function () {
    zlib.unzip(Buffer.from(GZIP_CONTENT, 'base64'), function (err, data) {
      t.notOk(err, 'should not error')
      t.equal(data.toString(), CONTENT)
      verifySegments(t, agent, 'zlib.unzip')
    })
  })
})

test('createGzip', function (t) {
  testStream(t, 'createGzip', CONTENT, GZIP_CONTENT)
})

test('createGunzip', function (t) {
  testStream(
    t,
    'createGunzip',
    Buffer.from(GZIP_CONTENT, 'base64'),
    Buffer.from(CONTENT).toString('base64')
  )
})

test('createUnzip', function (t) {
  testStream(
    t,
    'createUnzip',
    Buffer.from(GZIP_CONTENT, 'base64'),
    Buffer.from(CONTENT).toString('base64')
  )
})

test('createDeflate', function (t) {
  testStream(t, 'createDeflate', CONTENT, DEFLATED_CONTENT)
})

test('createInflate', function (t) {
  testStream(
    t,
    'createInflate',
    Buffer.from(DEFLATED_CONTENT, 'base64'),
    Buffer.from(CONTENT).toString('base64')
  )
})

test('createDeflateRaw', function (t) {
  testStream(t, 'createDeflateRaw', CONTENT, DEFLATED_RAW)
})

test('createInflateRaw', function (t) {
  testStream(
    t,
    'createInflateRaw',
    Buffer.from(DEFLATED_RAW, 'base64'),
    Buffer.from(CONTENT).toString('base64')
  )
})

function testStream(t, method, src, out) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (transaction) {
    const concatStream = concat(check)

    // The check callback is called when the stream finishes.
    const stream = zlib[method]()
    stream.pipe(concatStream)
    stream.end(src)

    function check(result) {
      t.equal(result.toString('base64'), out, 'should have correct result')
      t.equal(agent.getTransaction(), transaction)
      t.end()
    }
  })
}

function setupAgent(t) {
  const agent = helper.instrumentMockedAgent()
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  return agent
}
