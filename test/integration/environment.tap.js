/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')

test("Using should shouldn't cause the agent to explode on startup.", function (t) {
  t.plan(2)

  t.doesNotThrow(function () {
    require('should')
    const agent = new Agent(configurator.initialize())
    t.ok(agent.should)
  }, "shouldn't throw when should is included.")
})

test("Environment scraper shouldn't die if HOME isn't set.", function (t) {
  t.plan(2)

  delete process.env.HOME

  t.notOk(process.env.HOME, 'HOME has been nuked.')
  t.doesNotThrow(function () {
    return new Agent(configurator.initialize())
  }, "shouldn't throw just because HOME isn't set")
})
