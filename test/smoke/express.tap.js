var fork = require('child_process').fork
var http = require('http')
var path = require('path')
var util = require('util')

var assert = require('chai').assert

var EXIT_TYPES = ['error', 'exit', 'disconnect', 'close']
var exitHandlers = {}
var gotResponse = false

var server = fork(path.join(__dirname, 'express-server.js'))

// Bind to the various ways failure could happen
EXIT_TYPES.forEach(function (type) {
  exitHandlers[type] = unexpectedClose.bind(null, type)
  server.on(type, exitHandlers[type])
})

server.on('message', function incommingMessage (port) {
  var options = {
    hostname: 'localhost',
    port: port,
    path: '/',
    method: 'GET'
  }
  
  var data = ''
  http.get(options, function handleResponse (res) {
    res.setEncoding('utf8')

    res.on('data', function onData (chunk) {
      data += chunk
    })

    res.on('end', function onEnd () {
      assert.equal(data, 'hello world!')
      // unbind from the exit conditions 
      EXIT_TYPES.forEach(function (type) {
        server.removeListener(type, exitHandlers[type])
      })
      server.kill()
      gotResponse = true
    })
  })
})

process.on('exit', function onExit () {
  assert(gotResponse)
})

function unexpectedClose (type) {
  throw new Error(util.format('child process unexpectedly closed: %s', type))
}
