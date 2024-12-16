/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')

test("Using should shouldn't cause the agent to explode on startup.", (_, end) => {
  assert.doesNotThrow(function () {
    require('should')
    const agent = new Agent(configurator.initialize())
    assert.ok(agent.should)
    end()
  }, "shouldn't throw when should is included.")
})

test("Environment scraper shouldn't die if HOME isn't set.", () => {
  delete process.env.HOME

  assert.equal(process.env.HOME, undefined, 'HOME has been nuked.')
  assert.doesNotThrow(function () {
    return new Agent(configurator.initialize())
  }, "shouldn't throw just because HOME isn't set")
})
