/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')

tap.test('Fastify Instrumentation', (t) => {
  t.autoend()

  let agent = null
  let fastifyExport = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({
      feature_flag: {
        fastify_instrumentation: true
      }
    })
    fastifyExport = require('fastify')
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  /**
   * Fastify v3 has '.fastify' and '.default' properties attached to the exported
   * 'fastify' function.
   */
  t.test('Should propagate fastify properties when instrumented', (t) => {
    const original = fastifyExport.__NR_original

    for (const [key, value] of Object.entries(original)) {
      t.equal(fastifyExport[key], value)
    }

    t.end()
  })
})
