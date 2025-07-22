/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const semver = require('semver')

const { version: pkgVersion } = require('fastify/package')

const { removeModules } = require('../../lib/cache-buster')
const { assertCLMAttrs } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')
const common = require('./common')

test.beforeEach((ctx) => {
  ctx.nr = { agent: null, fastify: null, calls: { test: 0, middleware: 0 } }
})

test.afterEach((ctx) => {
  if (ctx.nr.agent) {
    helper.unloadAgent(ctx.nr.agent)
  }

  if (ctx.nr.fastify) {
    ctx.nr.fastify.close()
  }

  removeModules(['fastify', '@fastify/middie', 'middie'])
})

async function setup(t, config) {
  t.nr.agent = helper.instrumentMockedAgent(config)
  t.nr.fastify = require('fastify')()

  const { fastify, calls } = t.nr
  common.setupRoutes(fastify)

  if (semver.major(pkgVersion) < 4) {
    await fastify.register(require('middie'))
  } else {
    await fastify.register(require('@fastify/middie'))
  }
  common.registerMiddlewares({ fastify, calls })
}

function assertSegments({ t, trace, baseSegment, isCLMEnabled }) {
  const { agent } = t.nr
  let children = trace.getChildren(baseSegment.id)
  if (helper.isSecurityAgentEnabled(agent)) {
    children = trace.getChildren(children[0].id)
  }
  const [middieSegment, handlerSegment] = children
  assertCLMAttrs({
    segments: [
      {
        segment: middieSegment,
        name: 'runMiddie',
        filepath: /test\/versioned\/fastify\/node_modules\/(@fastify)?\/middie\/index.js/
      },
      {
        segment: handlerSegment,
        name: '(anonymous)',
        filepath: 'test/versioned/fastify/common.js'
      }
    ],
    enabled: isCLMEnabled
  })
}

async function performTest(t) {
  const { agent, fastify, calls } = t.nr
  const uri = common.routesToTest[0]

  agent.on('transactionFinished', (transaction) => {
    calls.test++
    const [baseSegment] = transaction.trace.getChildren(transaction.trace.root.id)
    assertSegments({
      t,
      baseSegment,
      trace: transaction.trace,
      isCLMEnabled: agent.config.code_level_metrics.enabled
    })
  })

  await fastify.listen({ port: 0 })
  const address = fastify.server.address()
  const result = await common.makeRequest(address, uri)

  assert.equal(result.called, uri, `${uri} url did not error`)
  assert.ok(calls.test > 0)
  assert.equal(calls.test, calls.middleware, 'should be the same value')
}

test('should add attributes', async (t) => {
  await setup(t, { code_level_metrics: { enabled: true } })
  await performTest(t)
})

test('should not add attributes', async (t) => {
  await setup(t, { code_level_metrics: { enabled: false } })
  await performTest(t)
})
