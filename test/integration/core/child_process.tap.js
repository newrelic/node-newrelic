'use strict'

var test = require('tap').test
var cp = require('child_process')
var fs = require('fs')
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify.js')

test('exec', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    cp.exec('ls', {cwd: __dirname}, function(err, stdout, stderr) {
      t.notOk(err, 'should not error')
      var files = stdout.trim().split('\n').sort()
      t.deepEqual(files, fs.readdirSync(__dirname).sort())
      t.equal(stderr, '')
      verifySegments(t, agent, 'child_process.exec', ['child_process.execFile'])
    })
  })
})

test('execFile', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function() {
    cp.execFile('./exec-me.js', {cwd: __dirname}, function(err, stdout, stderr) {
      t.notOk(err, 'should not error')
      t.equal(stdout, 'I am stdout\n')
      t.equal(stderr, 'I am stderr\n')
      verifySegments(t, agent, 'child_process.execFile')
    })
  })
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  return agent
}
