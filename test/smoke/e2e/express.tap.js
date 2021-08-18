/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const cp = require('child_process')
const http = require('http')
const path = require('path')
const util = require('util')
const tap = require('tap')

const EXIT_TYPES = ['error', 'exit', 'disconnect', 'close']
const exitHandlers = {}

tap.test('Express e2e request smoke test', (t) => {
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
        t.equal(data, 'hello world!', 'should return appropriate response data')
        // unbind from the exit conditions
        EXIT_TYPES.forEach((type) => {
          server.removeListener(type, exitHandlers[type])
        })
        server.kill()
        t.end()
      })
    })
  })

  function unexpectedClose(type) {
    throw new Error(util.format('child process unexpectedly closed: %s', type))
  }
})
