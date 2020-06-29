/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var helper = require('../../lib/agent_helper')


// bootstrap instrumentation
helper.instrumentMockedAgent()

// once instrumentation is bootstrapped
var express = require('express')
var app = express()
var server = require('http').createServer(app)


app.get('/test/:id', function(req, res, next) {
  process.nextTick(function() { throw new Error('threw in a timer', next) })
})

helper.ranomPort(function(port) {
  server.listen(port, function() {
    process.on('message', function(code) {
      helper.makeGetRequest('http://localhost:' + port + '/test/31337', function() {
        process.exit(code)
      })
    })
    process.send('ready')
  })
})
