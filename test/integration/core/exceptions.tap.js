'use strict'

var test = require('tap').test
var cp = require('child_process')
var path = require('path')


test("Uncaught exceptions", function (t) {
  var proc = startProc()

  var timer = setTimeout(function () {
    t.fail('child did not exit')
    proc.kill()
  }, 1000)

  proc.on('exit', function () {
    clearTimeout(timer)
    t.end()
  })

  proc.send({name: 'uncaughtException'})
})

test("Caught uncaught exceptions", function (t) {
  var proc = startProc()

  var theRightStuff = 31415927
  var timer = setTimeout(function () {
    t.fail('child hung')
    proc.kill()
  }, 1000)

  proc.on('message', function (code) {
    t.equal(parseInt(code, 10), theRightStuff)
    clearTimeout(timer)
    proc.kill()
    t.end()
  })

  proc.send({name: 'caughtUncaughtException', args: theRightStuff})
})

test("Report uncaught exceptions", function (t) {
  t.plan(2)

  var proc = startProc()
  var message = 'I am a test error'
  var messageReceived = false

  proc.on('message', function(errors) {
    messageReceived = true
    t.equal(errors.count, 1)
    t.equal(errors.messages[0], message)
    proc.kill()
  })

  proc.on('exit', function () {
    t.end()
  })

  proc.send({name: 'checkAgent', args: message})
})

function startProc () {
  var testDir = path.resolve(__dirname, '../../')
  return cp.fork(path.join(testDir, 'helpers/exceptions.js'), {silent: true})
}
