/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const util = require('util')
const path = require('path')
const helper = require('../../lib/agent_helper')

test('promisify', { skip: !util.promisify }, function (t) {
  t.autoend()
  t.test('should work on setTimeout', function (t) {
    t.plan(2)
    const agent = helper.instrumentMockedAgent()
    t.teardown(function () {
      helper.unloadAgent(agent)
    })
    const asyncTimeout = util.promisify(setTimeout)
    asyncTimeout(10, 'foobar')
      .then((val) => {
        t.equal(val, 'foobar', 'setTimeout parameter should flow')
        t.ok(true, 'should evaluate properly')
        t.end()
      })
      .catch((ex) => {
        t.error(ex)
      })
  })
  t.test('should work on setImmediate', function (t) {
    t.plan(2)
    const agent = helper.instrumentMockedAgent()
    t.teardown(function () {
      helper.unloadAgent(agent)
    })
    const asyncImmediate = util.promisify(setImmediate)
    asyncImmediate('foobar')
      .then((val) => {
        t.equal(val, 'foobar', 'setImmediate parameter should flow')
        t.pass('should evaluate properly')
        t.end()
      })
      .catch((ex) => {
        t.error(ex)
      })
  })
  t.test('should work on child_process.exec', function (t) {
    t.plan(3)
    const agent = helper.instrumentMockedAgent()
    t.teardown(function () {
      helper.unloadAgent(agent)
    })
    const asyncExec = util.promisify(require('child_process').exec)
    asyncExec('ls')
      .then((result) => {
        t.type(result, 'object', 'first argument should be object')
        t.type(result.stdout, 'string', 'should have string stdout')
        t.type(result.stderr, 'string', 'should have string stderr')
      })
      .catch((ex) => {
        t.error(ex)
      })
  })
  t.test('should work on child_process.execFile', function (t) {
    t.plan(3)
    const agent = helper.instrumentMockedAgent()
    t.teardown(function () {
      helper.unloadAgent(agent)
    })
    const asyncExec = util.promisify(require('child_process').execFile)
    asyncExec(path.join(__dirname, 'exec-me.js'))
      .then((result) => {
        t.type(result, 'object', 'first argument should be object')
        t.type(result.stdout, 'string', 'should have string stdout')
        t.type(result.stderr, 'string', 'should have string stderr')
      })
      .catch((ex) => {
        t.error(ex)
      })
  })

  t.test('should work on fs.exists', function (t) {
    t.plan(1)

    const agent = helper.instrumentMockedAgent()
    t.teardown(function () {
      helper.unloadAgent(agent)
    })

    // eslint-disable-next-line node/no-deprecated-api
    const asyncExists = util.promisify(require('fs').exists)

    asyncExists(path.join(__dirname, 'exec-me.js'))
      .then(() => {
        t.ok(true, 'should find file')
        t.end()
      })
      .catch((ex) => {
        t.error(ex)
      })
  })
})
