/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const semver = require('semver')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')
const { makeRequest } = require('./common')

test('Test Errors', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const agent = helper.instrumentMockedAgent()
  agent.on('transactionFinished', (tx) => {
    plan.equal(tx.exceptions.length, 1)
    plan.equal(tx.exceptions[0].error.message, 'Not found')
  })

  const fastify = require('fastify')()
  const { version: pkgVersion } = require('fastify/package')

  t.after(() => {
    helper.unloadAgent(agent)
    fastify.close()
  })

  if (semver.major(pkgVersion) < 4) {
    await fastify.register(require('middie'))
  } else {
    await fastify.register(require('@fastify/middie'))
  }

  fastify.use((req, res, next) => {
    const err = new Error('Not found')

    err.status = 404
    next(err)
  })

  await fastify.listen({ port: 0 })
  const address = fastify.server.address()
  const res = await makeRequest(address, '/404-via-reply')
  plan.equal(res.statusCode, 404)
})
