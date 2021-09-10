/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const shims = require('../../../../lib/shim')
const helper = require('../../../lib/agent_helper')
const instrument = require('../../../../lib/instrumentation/hapi')
const utils = require('./hapi-utils')

tap.test('instrumentation of Hapi', function (t) {
  t.autoend()

  t.test('preserves server creation return', function (t) {
    const agent = helper.loadMockedAgent()
    const hapi = require('hapi')
    const returned = utils.getServer({ hapi: hapi })

    t.ok(returned != null, 'Hapi returns from server creation')

    const shim = new shims.WebFrameworkShim(agent, 'hapi')
    instrument(agent, hapi, 'hapi', shim)

    const returned2 = utils.getServer({ hapi: hapi })

    t.ok(returned2 != null, 'Server creation returns when instrumented')

    t.end()
  })
})
