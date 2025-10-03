/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { assertPackageMetrics, match } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')
const { version } = require('@grpc/grpc-js/package.json')

const { ERR_CODE, ERR_MSG } = require('./constants.cjs')
const {
  assertError,
  assertExternalSegment,
  assertMetricsNotExisting,
  makeUnaryRequest,
  createServer,
  getClient
} = require('./util.cjs')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.grpc = require('@grpc/grpc-js')

  const { port, proto, server } = await createServer(ctx.nr.grpc)
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

test('should log tracking metrics', function(t) {
  const { agent } = t.nr
  assertPackageMetrics({ agent, pkg: '@grpc/grpc-js', version })
})

test('should track unary client requests as an external when in a transaction', (t, end) => {
  const { agent, client, port } = t.nr
  helper.runInTransaction(agent, 'web', async (tx) => {
    tx.name = 'clientTransaction'
    agent.on('transactionFinished', (transaction) => {
      if (transaction.name === 'clientTransaction') {
        // Make sure we're in the client and not server transaction
        assertExternalSegment({ tx: transaction, fnName: 'SayHello', port })
        end()
      }
    })

    const response = await makeUnaryRequest({
      client,
      fnName: 'sayHello',
      payload: { name: 'New Relic' }
    })
    assert.ok(response, 'response exists')
    assert.equal(response.message, 'Hello New Relic', 'response message is correct')
    tx.end()
  })
})

test('should include distributed trace headers when enabled', (t, end) => {
  const { agent, client, server } = t.nr
  helper.runInTransaction(agent, 'dt-test', async (tx) => {
    const payload = { name: 'dt test' }
    await makeUnaryRequest({ client, fnName: 'sayHello', payload })
    const dtMeta = server.metadataMap.get(payload.name)
    match(
      dtMeta.get('traceparent')[0],
      /^[\w-]{55}$/,
      'should have traceparent in server metadata'
    )
    tx.end()
    end()
  })
})

test('should not include distributed trace headers when not in transaction', async (t) => {
  const { client, server } = t.nr
  const payload = { name: 'dt not in transaction' }
  await makeUnaryRequest({ client, fnName: 'sayHello', payload })
  const dtMeta = server.metadataMap.get(payload.name)
  assert.equal(dtMeta.has('traceparent'), false, 'should not have traceparent in server metadata')
  assert.equal(dtMeta.has('newrelic'), false, 'should not have newrelic in server metadata')
})

test('should not include distributed trace headers when distributed_tracing.enabled is set to false', (t, end) => {
  const { agent, client, server } = t.nr
  agent.config.distributed_tracing.enabled = false
  helper.runInTransaction(agent, 'dt-test', async (tx) => {
    const payload = { name: 'dt disabled' }
    await makeUnaryRequest({ client, payload, fnName: 'sayHello' })
    const dtMeta = server.metadataMap.get(payload.name)
    assert.equal(dtMeta.has('traceparent'), false, 'should not have traceparent in server metadata')
    assert.equal(dtMeta.has('newrelic'), false, 'should not have newrelic in server metadata')
    tx.end()
    end()
  })
})

test('should not track external unary client requests outside of a transaction', async (t) => {
  const { agent, client, port } = t.nr
  const payload = { name: 'New Relic' }
  const response = await makeUnaryRequest({ client, fnName: 'sayHello', payload })
  assert.ok(response, 'response exists')
  assert.equal(response.message, 'Hello New Relic', 'response message is correct')
  assertMetricsNotExisting({ agent, port })
})

const grpcConfigs = [
  { record_errors: true, ignore_status_codes: [], should: true },
  { record_errors: false, ignore_status_codes: [], should: false },
  { record_errors: true, ignore_status_codes: [9], should: false }
]
for (const config of grpcConfigs) {
  const should = config.should ? 'should' : 'should not'
  const testName = `${should} record errors in a transaction when ignoring ${config.ignore_status_codes}`

  test(testName, (t, end) => {
    const { agent, client, port } = t.nr
    const expectedStatusText = ERR_MSG
    const expectedStatusCode = ERR_CODE
    agent.config.grpc.record_errors = config.record_errors
    agent.config.grpc.ignore_status_codes = config.ignore_status_codes
    helper.runInTransaction(agent, 'web', async (tx) => {
      tx.name = 'clientTransaction'
      agent.on('transactionFinished', (transaction) => {
        if (transaction.name === 'clientTransaction') {
          assertError({
            port,
            transaction,
            errors: agent.errors,
            expectErrors: config.should,
            expectedStatusCode,
            expectedStatusText,
            fnName: 'SayError',
            clientError: true
          })
          end()
        }
      })

      try {
        const payload = { oh: 'noes' }
        await makeUnaryRequest({ client, fnName: 'sayError', payload })
      } catch (err) {
        assert.ok(err, 'should get an error')
        assert.equal(err.code, expectedStatusCode, 'should get the right status code')
        assert.equal(err.details, expectedStatusText, 'should get the correct error message')
        tx.end()
      }
    })
  })
}

test('should bind callback to the proper transaction context', (t, end) => {
  const { agent, client } = t.nr
  helper.runInTransaction(agent, 'web', async (tx) => {
    client.sayHello({ name: 'Callback' }, (err, response) => {
      assert.ifError(err)
      assert.ok(response)
      assert.equal(response.message, 'Hello Callback')
      assert.ok(agent.getTransaction(), 'callback should have transaction context')
      assert.equal(agent.getTransaction(), tx, 'transaction should be the one we started with')
      end()
    })
  })
})
