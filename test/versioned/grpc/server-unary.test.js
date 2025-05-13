/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { notHas } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')

const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT

const { ERR_CODE, ERR_SERVER_MSG } = require('./constants.cjs')
const {
  assertError,
  assertDistributedTracing,
  assertServerMetrics,
  assertServerTransaction,
  makeUnaryRequest,
  createServer,
  getClient,
  getServerTransactionName
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

test('should track unary server requests', async (t) => {
  const { agent, client } = t.nr
  let transaction
  agent.on('transactionFinished', (tx) => {
    transaction = tx
  })

  const response = await makeUnaryRequest({
    client,
    fnName: 'sayHello',
    payload: { name: 'New Relic' }
  })
  assert.ok(response, 'response exists')
  assert.equal(response.message, 'Hello New Relic', 'response message is correct')
  assert.ok(transaction, 'transaction exists')
  assertServerTransaction({ transaction, fnName: 'SayHello' })
  assertServerMetrics({ agentMetrics: agent.metrics._metrics, fnName: 'SayHello' })
})

test('should add DT headers when `distributed_tracing` is enabled', async (t) => {
  const { agent, client } = t.nr
  let serverTransaction
  let clientTransaction
  agent.on('transactionFinished', (tx) => {
    if (tx.name === getServerTransactionName('SayHello')) {
      serverTransaction = tx
    }
  })

  await helper.runInTransaction(agent, 'web', async (tx) => {
    clientTransaction = tx
    clientTransaction.name = 'clientTransaction'
    const response = await makeUnaryRequest({
      client,
      fnName: 'sayHello',
      payload: { name: 'New Relic' }
    })
    assert.ok(response, 'response exists')
    tx.end()
  })

  assertDistributedTracing({ clientTransaction, serverTransaction })
})

test('should not include distributed trace headers when there is no client transaction', async (t) => {
  const { agent, client } = t.nr
  let serverTransaction
  agent.on('transactionFinished', (tx) => {
    serverTransaction = tx
  })
  const payload = { name: 'dt not in transaction' }
  const response = await makeUnaryRequest({ client, fnName: 'sayHello', payload })
  assert.ok(response, 'response exists')
  const attributes = serverTransaction.trace.attributes.get(DESTINATION)
  notHas({
    found: attributes,
    doNotWant: 'request.header.traceparent',
    msg: 'should not have traceparent in headers'
  })
})

test('should not add DT headers when `distributed_tracing` is disabled', async (t) => {
  const { agent, client } = t.nr
  let serverTransaction
  let clientTransaction
  agent.on('transactionFinished', (tx) => {
    if (tx.name === getServerTransactionName('SayHello')) {
      serverTransaction = tx
    }
  })

  agent.config.distributed_tracing.enabled = false
  await helper.runInTransaction(agent, 'web', async (tx) => {
    clientTransaction = tx
    clientTransaction.name = 'clientTransaction'
    const response = await makeUnaryRequest({
      client,
      fnName: 'sayHello',
      payload: { name: 'New Relic' }
    })
    assert.ok(response, 'response exists')
    tx.end()
  })

  const attributes = serverTransaction.trace.attributes.get(DESTINATION)
  notHas({
    found: attributes,
    doNotWant: 'request.header.traceparent',
    msg: 'should not have traceparent in headers'
  })
})

const grpcConfigs = [
  { record_errors: true, ignore_status_codes: [], should: true },
  { record_errors: false, ignore_status_codes: [], should: false },
  { record_errors: true, ignore_status_codes: [9], should: false }
]
for (const config of grpcConfigs) {
  const should = config.should ? 'should' : 'should not'
  const testName = `${should} record errors in a transaction when ignoring ${config.ignore_status_codes}`

  test(testName, async (t) => {
    const { agent, client } = t.nr
    agent.config.grpc.record_errors = config.record_errors
    agent.config.grpc.ignore_status_codes = config.ignore_status_codes
    const expectedStatusCode = ERR_CODE
    const expectedStatusText = ERR_SERVER_MSG
    let transaction
    agent.on('transactionFinished', (tx) => {
      if (tx.name === getServerTransactionName('SayError')) {
        transaction = tx
      }
    })

    try {
      await makeUnaryRequest({
        client,
        fnName: 'sayError',
        payload: { oh: 'noes' }
      })
    } catch {
      // err tested in client tests
    }

    assertError({
      transaction,
      errors: agent.errors,
      agentMetrics: agent.metrics._metrics,
      expectErrors: config.should,
      expectedStatusCode,
      expectedStatusText,
      fnName: 'SayError'
    })
  })
}
