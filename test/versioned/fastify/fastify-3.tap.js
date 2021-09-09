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
   * 'fastify' function. These are all the same original exported function, just
   * arranged to support a variety of import styles.
   */
  t.test('Should propagate fastify exports when instrumented', (t) => {
    const original = fastifyExport.__NR_original

    // Confirms the original setup matches expectations
    t.equal(original.fastify, original)
    t.equal(original.default, original)

    // Asserts our new export has the same behavior
    t.equal(fastifyExport.fastify, fastifyExport)
    t.equal(fastifyExport.default, fastifyExport)

    t.end()
  })
})
