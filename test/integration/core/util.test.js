/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const util = require('util')
const path = require('path')
const helper = require('../../lib/agent_helper')

test('promisify', async function (t) {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })
  await t.test('should work on setTimeout', async function () {
    const asyncTimeout = util.promisify(setTimeout)
    const val = await asyncTimeout(10, 'foobar')
    assert.equal(val, 'foobar', 'setTimeout parameter should flow')
  })
  await t.test('should work on setImmediate', async function () {
    const asyncImmediate = util.promisify(setImmediate)
    const val = await asyncImmediate('foobar')
    assert.equal(val, 'foobar', 'setImmediate parameter should flow')
  })
  await t.test('should work on child_process.exec', async function () {
    const asyncExec = util.promisify(require('child_process').exec)
    const result = await asyncExec('ls')
    assert.ok(typeof result === 'object', 'first argument should be object')
    assert.ok(typeof result.stdout === 'string', 'should have string stdout')
    assert.ok(typeof result.stderr === 'string', 'should have string stderr')
  })
  await t.test('should work on child_process.execFile', async function () {
    const asyncExec = util.promisify(require('child_process').execFile)
    const result = await asyncExec(path.join(__dirname, 'exec-me.js'))
    assert.ok(typeof result === 'object', 'first argument should be object')
    assert.ok(typeof result.stdout === 'string', 'should have string stdout')
    assert.ok(typeof result.stderr === 'string', 'should have string stderr')
  })

  await t.test('should work on fs.exists', async function () {
    // eslint-disable-next-line node/no-deprecated-api
    const asyncExists = util.promisify(require('fs').exists)

    const result = await asyncExists(path.join(__dirname, 'exec-me.js'))
    assert.equal(result, true, 'should find file')
  })
})
