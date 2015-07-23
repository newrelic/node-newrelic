'use strict'

var test = require('tap').test
var cp = require('child_process')
var path = require('path')

test("Uncaught exceptions", function (t) {
  var proc = cp.fork(path.join(__dirname, 'uncaught.js'))
  var timer = setTimeout(function () {
    t.fail('child did not exit')
    proc.kill()
  }, 1000)

  proc.on('exit', function () {
    clearTimeout(timer)
    t.end()
  })
})

test("Caught uncaught exceptions", function (t) {
  var proc = cp.fork(path.join(__dirname, 'caught.js'))
  var theRightStuff = 31415927
  var timer = setTimeout(function () {
    t.fail('child hung')
    proc.kill()
  }, 1000)

  proc.send(theRightStuff)

  proc.on('message', function (code) {
    t.equal(parseInt(code, 10), theRightStuff)
    clearTimeout(timer)
    proc.kill()
    t.end()
  })
})
