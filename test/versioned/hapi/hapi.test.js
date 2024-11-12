/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const instrument = require('../../../lib/instrumentation/@hapi/hapi')
const shims = require('../../../lib/shim')
const helper = require('../../lib/agent_helper')
const utils = require('./hapi-utils')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  ctx.nr.server = utils.getServer()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.stop()
})

test('preserves server creation return', (t) => {
  const { agent } = t.nr

  const hapi = require('@hapi/hapi')
  const returned = utils.getServer({ hapi: hapi })

  assert.ok(returned != null, 'Hapi returns from server creation')

  const shim = new shims.WebFrameworkShim(agent, 'hapi')
  instrument(agent, hapi, 'hapi', shim)

  const returned2 = utils.getServer({ hapi: hapi })

  assert.ok(returned2 != null, 'Server creation returns when instrumented')
})
