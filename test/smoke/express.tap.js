'use strict'

const cp = require('child_process')
const http = require('http')
const path = require('path')
const util = require('util')

const assert = require('chai').assert

const EXIT_TYPES = ['error', 'exit', 'disconnect', 'close']
const exitHandlers = {}
let gotResponse = false

const server = cp.fork(path.join(__dirname, 'express-server'))

// Bind to the various ways failure could happen
EXIT_TYPES.forEach((type) => {
  exitHandlers[type] = unexpectedClose.bind(null, type)
  server.on(type, exitHandlers[type])
})

server.on('message', function incommingMessage(port) {
  const options = {
    hostname: 'localhost',
    port: port,
    path: '/',
    method: 'GET'
  }

  let data = ''
  http.get(options, function handleResponse(res) {
    res.setEncoding('utf8')

    res.on('data', function onData(chunk) {
      data += chunk
    })

    res.on('end', function onEnd() {
      assert.equal(data, 'hello world!')
      // unbind from the exit conditions
      EXIT_TYPES.forEach((type) => {
        server.removeListener(type, exitHandlers[type])
      })
      server.kill()
      gotResponse = true
    })
  })
})

process.on('exit', function onExit() {
  assert(gotResponse)
})

function unexpectedClose(type) {
  throw new Error(util.format('child process unexpectedly closed: %s', type))
}
