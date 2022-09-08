/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')

helper.instrumentMockedAgent()

const test = require('tap').test
const http = require('http')
const app = require('express')()

test("adding 'handle' middleware", function (t) {
  t.plan(2)

  // eslint-disable-next-line no-unused-vars
  function handle(err, req, res, next) {
    t.ok(err, 'error should exist')

    res.statusCode = 500
    res.end()
  }

  app.use('/', function () {
    throw new Error()
  })

  app.use(handle)

  app.listen(function () {
    const server = this
    const port = server.address().port

    http
      .request({ port: port }, function (res) {
        // drain response to let process exit
        res.pipe(process.stderr)

        t.equal(res.statusCode, 500)
        server.close()
      })
      .end()
  })
})
