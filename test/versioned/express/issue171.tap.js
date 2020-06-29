/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var helper = require('../../lib/agent_helper')

helper.instrumentMockedAgent()

var test = require('tap').test
var http = require('http')
var app = require('express')()


test("adding 'handle' middleware", function(t) {
  t.plan(2)

  function handle(err, req, res, next) { // eslint-disable-line no-unused-vars
    t.ok(err, 'error should exist')

    res.statusCode = 500
    res.end()
  }

  app.use('/', function() {
    throw new Error()
  })

  app.use(handle)

  var server = app.listen(function() {
    var port = server.address().port

    http.request({port: port}, function(res) {
      // drain response to let process exit
      res.pipe(process.stderr)

      t.equal(res.statusCode, 500)
      server.close()
    }).end()
  })
})
