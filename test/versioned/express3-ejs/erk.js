'use strict'

var path    = require('path')
  , request = require('request')
  , helper  = require('../../lib/agent_helper.js')


// bootstrap instrumentation
helper.instrumentMockedAgent()

// once instrumentation is bootstrapped
var express = require('express')
  , app     = express()
  , server  = require('http').createServer(app)


app.get('/test/:id', function (req, res, next) {
  process.nextTick(function cb_nextTick() { throw new Error('threw in a timer', next); })
})

server.listen(8089, function () {
  process.on('message', function (code) {
    request.get('http://localhost:8089/test/31337', function () {
      process.exit(code)
    })
  })
  process.send('ready')
})
