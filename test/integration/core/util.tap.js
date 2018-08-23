'use strict'

const test = require('tap').test
const util = require('util')
const path = require('path')
const helper = require('../../lib/agent_helper')

test('promisify', {skip: !util.promisify}, function(t) {
  t.plan(4)
  t.test('should work on setTimeout', function(t) {
    t.plan(1)
    var agent = helper.instrumentMockedAgent()
    t.tearDown(function() {
      helper.unloadAgent(agent)
    })
    let asyncTimeout = util.promisify(setTimeout)
    asyncTimeout(10)
      .then(() => {
        t.ok(true, 'should evaluate properly')
        t.end()
      })
      .catch(ex => {
        t.error(ex)
      })
  })
  t.test('should work on setImmediate', function(t) {
    t.plan(1)
    var agent = helper.instrumentMockedAgent()
    t.tearDown(function() {
      helper.unloadAgent(agent)
    })
    let asyncImmediate = util.promisify(setImmediate)
    asyncImmediate()
      .then(() => {
        t.ok(true, 'should evaluate properly')
        t.end()
      })
      .catch(ex => {
        t.error(ex)
      })
  })
  t.test('should work on child_process.exec', function(t) {
    t.plan(1)
    var agent = helper.instrumentMockedAgent()
    t.tearDown(function() {
      helper.unloadAgent(agent)
    })
    let asyncExec = util.promisify(require('child_process').exec)
    asyncExec('ls')
      .then(() => {
        t.ok(true, 'should evaluate properly')
        t.end()
      })
      .catch(ex => {
        t.error(ex)
      })
  })
  t.test('should work on child_process.execFile', function(t) {
    t.plan(1)
    var agent = helper.instrumentMockedAgent()
    t.tearDown(function() {
      helper.unloadAgent(agent)
    })
    let asyncExec = util.promisify(require('child_process').execFile)
    asyncExec(path.join(__dirname, 'exec-me.js'))
      .then(() => {
        t.ok(true, 'should evaluate properly')
        t.end()
      })
      .catch(ex => {
        t.error(ex)
      })
  })
})
