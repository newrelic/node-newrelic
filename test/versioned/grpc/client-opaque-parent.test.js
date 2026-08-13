/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')

const {
  assertMetricsNotExisting,
  makeUnaryRequest,
  createServer,
  getClient
} = require('./util.cjs')

// When the active segment is opaque (e.g. a nested client call under a parent
// gRPC External segment), GrpcClientSubscriber.handler() should detect that
// createSegment() produced no new segment and skip the metadata clone, args
// mutation, and DT header injection entirely. The tests show:
//
//  1. No External segment should be recorded for the nested call.
//  2. No DT headers should be injected into the outbound metadata.

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.grpc = require('@grpc/grpc-js')

  const { port, proto, server } = await createServer(ctx.nr.grpc, ctx.nr.agent)
  ctx.nr.port = port
  ctx.nr.proto = proto
  ctx.nr.server = server
  ctx.nr.client = getClient(ctx.nr.grpc, proto, port)
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.forceShutdown()
  ctx.nr.client.close()
  removeModules(['@grpc/grpc-js'])
})

test('should not create an External segment when the parent segment is opaque', (t, end) => {
  const { agent, client, port } = t.nr

  helper.runInTransaction(agent, 'web', async (tx) => {
    tx.name = 'opaqueParentTransaction'

    // Mark the current (base) segment opaque to simulate being inside another
    // instrumented call whose segment blocks child creation (e.g. a parent
    // gRPC External segment, which the subscriber marks opaque=true).
    const ctx = agent.tracer.getContext()
    ctx.segment.opaque = true

    await makeUnaryRequest({
      client,
      fnName: 'sayHello',
      payload: { name: 'opaque-no-segment' }
    })

    agent.on('transactionFinished', (transaction) => {
      if (transaction.name === 'opaqueParentTransaction') {
        assertMetricsNotExisting({ agent, port })
        end()
      }
    })

    tx.end()
  })
})

test('should not inject distributed trace headers when the parent segment is opaque', (t, end) => {
  const { agent, client, server } = t.nr

  helper.runInTransaction(agent, 'web', async (tx) => {
    const payload = { name: 'opaque-no-dt-headers' }

    const ctx = agent.tracer.getContext()
    ctx.segment.opaque = true

    await makeUnaryRequest({
      client,
      fnName: 'sayHello',
      payload
    })

    const dtMeta = server.metadataMap.get(payload.name)
    assert.equal(
      dtMeta.has('traceparent'),
      false,
      'should not inject traceparent into metadata when parent segment is opaque'
    )
    assert.equal(
      dtMeta.has('newrelic'),
      false,
      'should not inject newrelic header into metadata when parent segment is opaque'
    )

    tx.end()
    end()
  })
})
