/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tsplan = require('@matteo.collina/tspl')
const { setup, teardown } = require('./utils')
const http = require('http')

test.beforeEach(async (ctx) => {
  await setup(ctx)
})

test.afterEach(teardown)

test("adding 'handle' middleware", async function (t) {
  const { app, port } = t.nr
  const plan = tsplan(t, { plan: 2 })

  // eslint-disable-next-line no-unused-vars
  function handle(err, req, res, next) {
    plan.ok(err, 'error should exist')

    res.statusCode = 500
    res.end()
  }

  app.use('/', function () {
    throw new Error()
  })

  app.use(handle)

  http
    .request({ port: port }, function (res) {
      // drain response to let process exit
      res.pipe(process.stderr)

      plan.equal(res.statusCode, 500)
    })
    .end()
  await plan.completed
})
