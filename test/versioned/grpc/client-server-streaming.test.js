/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { match } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')

const { ERR_CODE, ERR_MSG } = require('./constants.cjs')
const {
  assertError,
  assertExternalSegment,
  assertMetricsNotExisting,
  makeServerStreamingRequest,
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

test('should track server streaming requests as an external when in a transaction', (t, end) => {
  const { agent, client, port } = t.nr
  helper.runInTransaction(agent, 'web', async (tx) => {
    tx.name = 'clientTransaction'
    agent.on('transactionFinished', (transaction) => {
      if (transaction.name === 'clientTransaction') {
        // Make sure we're in the client and not server transaction
        assertExternalSegment({ tx: transaction, fnName: 'SayHelloServerStream', port })
        end()
      }
    })

    const names = ['Bob', 'Jordi', 'Corey']
    const responses = await makeServerStreamingRequest({
      client,
      fnName: 'sayHelloServerStream',
      payload: { name: names }
    })
    names.forEach((name, i) => {
      assert.equal(responses[i], `Hello ${name}`, 'response stream message should be correct')
    })
    tx.end()
  })
})

test('should include distributed trace headers when enabled', (t, end) => {
  const { agent, client, server } = t.nr
  helper.runInTransaction(agent, 'dt-test', async (tx) => {
    const payload = { name: ['dt test', 'dt test 2'] }
    await makeServerStreamingRequest({ client, fnName: 'sayHelloServerStream', payload })
    payload.name.forEach((name) => {
      const dtMeta = server.metadataMap.get(name)
      match(
        dtMeta.get('traceparent')[0],
        /^[\w-]{55}$/,
        'should have traceparent in server metadata'
      )
    })
    tx.end()
    end()
  })
})

test('should not include distributed trace headers when not in transaction', async (t) => {
  const { client, server } = t.nr
  const payload = { name: ['dt not in transaction'] }
  await makeServerStreamingRequest({ client, fnName: 'sayHelloServerStream', payload })
  const dtMeta = server.metadataMap.get(payload.name[0])
  assert.equal(dtMeta.has('traceparent'), false, 'should not have traceparent in server metadata')
  assert.equal(dtMeta.has('newrelic'), false, 'should not have newrelic in server metadata')
})

test('should not include distributed trace headers when distributed_tracing.enabled is set to false', (t, end) => {
  const { agent, client, server } = t.nr
  agent.config.distributed_tracing.enabled = false
  helper.runInTransaction(agent, 'dt-test', async (tx) => {
    const payload = { name: ['dt not in transaction'] }
    await makeServerStreamingRequest({ client, fnName: 'sayHelloServerStream', payload })
    const dtMeta = server.metadataMap.get(payload.name[0])
    assert.equal(dtMeta.has('traceparent'), false, 'should not have traceparent in server metadata')
    assert.equal(dtMeta.has('newrelic'), false, 'should not have newrelic in server metadata')
    tx.end()
    end()
  })
})

test('should not track server streaming requests outside of a transaction', async (t) => {
  const { agent, client, port } = t.nr
  const payload = { name: ['New Relic'] }
  const responses = await makeServerStreamingRequest({
    client,
    fnName: 'sayHelloServerStream',
    payload
  })
  assert.ok(responses.length, 1)
  assert.equal(responses[0], 'Hello New Relic', 'response message is correct')
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
            fnName: 'SayErrorServerStream',
            clientError: true
          })
          end()
        }
      })

      try {
        const payload = { name: ['noes'] }
        await makeServerStreamingRequest({ client, fnName: 'sayErrorServerStream', payload })
      } catch (err) {
        assert.ok(err, 'should get an error')
        assert.equal(err.code, expectedStatusCode, 'should get the right status code')
        assert.equal(err.details, expectedStatusText, 'should get the correct error message')
        tx.end()
      }
    })
  })
}
