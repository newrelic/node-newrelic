/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const crypto = require('crypto')
const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('pbkdf2', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    crypto.pbkdf2('hunter2', 'saltine', 5, 32, 'sha1', function (err, key) {
      assert.ok(!err, 'should not error')
      assert.equal(key.length, 32)
      verifySegments({ agent, end, name: 'crypto.pbkdf2' })
    })
  })
})

test('randomBytes', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    crypto.randomBytes(32, function (err, key) {
      assert.ok(!err, 'should not error')
      assert.ok(key.length, 32)
      verifySegments({ agent, end, name: 'crypto.randomBytes' })
    })
  })
})

test('sync randomBytes', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const bytes = crypto.randomBytes(32)
    assert.ok(bytes instanceof Buffer)
    assert.equal(bytes.length, 32)
    assert.equal(transaction.trace.root.children.length, 0)
    end()
  })
})

test('pseudoRandomBytes', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    // eslint-disable-next-line node/no-deprecated-api
    crypto.pseudoRandomBytes(32, function (err, key) {
      assert.ok(!err, 'should not error')
      assert.ok(key.length, 32)
      verifySegments({ agent, end, name: 'crypto.pseudoRandomBytes' })
    })
  })
})

test('sync pseudoRandomBytes', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    // eslint-disable-next-line node/no-deprecated-api
    const bytes = crypto.pseudoRandomBytes(32)
    assert.ok(bytes instanceof Buffer)
    assert.equal(bytes.length, 32)
    assert.equal(transaction.trace.root.children.length, 0)
    end()
  })
})

test('randomFill', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function () {
    const buf = Buffer.alloc(10)
    crypto.randomFill(buf, function (err, buffer) {
      assert.ok(!err, 'should not error')
      assert.ok(buffer.length, 10)
      verifySegments({ agent, end, name: 'crypto.randomFill' })
    })
  })
})

test('sync randomFill', function (t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function (transaction) {
    const buf = Buffer.alloc(10)
    crypto.randomFillSync(buf)
    assert.ok(buf instanceof Buffer)
    assert.equal(buf.length, 10)
    assert.equal(transaction.trace.root.children.length, 0)
    end()
  })
})

test('scrypt', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, () => {
    crypto.scrypt('secret', 'salt', 10, (err, buf) => {
      assert.ok(!err, 'should not error')
      assert.ok(buf.length, 10)
      verifySegments({ agent, end, name: 'crypto.scrypt' })
    })
  })
})

test('scryptSync', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, (transaction) => {
    const buf = crypto.scryptSync('secret', 'salt', 10)
    assert.ok(buf instanceof Buffer)
    assert.equal(buf.length, 10)
    assert.equal(transaction.trace.root.children.length, 0)
    end()
  })
})
