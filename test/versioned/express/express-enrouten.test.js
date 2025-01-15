/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This test checks for regressions on the route stack manipulation for Express apps.
 */
'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { isExpress5, teardown } = require('./utils')
const tsplan = require('@matteo.collina/tspl')
const { setup } = require('./utils')

test.beforeEach(async (ctx) => {
  await setup(ctx)
})

test.afterEach(teardown)

test('Express + express-enrouten compatibility test', { skip: isExpress5() }, async function (t) {
  const { app, port } = t.nr
  const plan = tsplan(t, { plan: 4 })

  const enrouten = require('express-enrouten')
  app.use(enrouten({ directory: './fixtures' }))

  // New Relic + express-enrouten used to have a bug, where any routes after the
  // first one would be lost.
  helper.makeGetRequest('http://localhost:' + port + '/', function (error, res) {
    plan.ifError(error)
    plan.equal(res.statusCode, 200, 'First Route loaded')
  })

  helper.makeGetRequest('http://localhost:' + port + '/foo', function (error, res) {
    plan.ifError(error)
    plan.equal(res.statusCode, 200, 'Second Route loaded')
  })
  await plan.completed
})
