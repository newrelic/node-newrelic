/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This test checks for regressions on the route stack manipulation for Express apps.
 */
'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')

test('Express + express-enrouten compatibility test', function (t) {
  t.plan(2)

  const agent = helper.instrumentMockedAgent()
  const express = require('express')
  const enrouten = require('express-enrouten')
  const app = express()
  const server = require('http').createServer(app)

  app.use(enrouten({ directory: './fixtures' }))

  t.teardown(() => {
    server.close(() => {
      helper.unloadAgent(agent)
    })
  })

  // New Relic + express-enrouten used to have a bug, where any routes after the
  // first one would be lost.
  server.listen(0, function () {
    const port = server.address().port
    helper.makeGetRequest('http://localhost:' + port + '/', function (error, res) {
      t.equal(res.statusCode, 200, 'First Route loaded')
    })

    helper.makeGetRequest('http://localhost:' + port + '/foo', function (error, res) {
      t.equal(res.statusCode, 200, 'Second Route loaded')
    })
  })
})
