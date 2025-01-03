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

const { ERR_CODE, ERR_SERVER_MSG, HALT_CODE, HALT_GRPC_SERVER_MSG } = require('./constants.cjs')
const {
  assertError,
  assertDistributedTracing,
  assertServerMetrics,
  assertServerTransaction,
  makeClientStreamingRequest,
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

test('should track client streaming requests', async (t) => {
  const { agent, client } = t.nr
  let transaction
  agent.on('transactionFinished', (tx) => {
    transaction = tx
  })

  const names = [{ name: 'Bob' }, { name: 'Jordi' }, { name: 'Corey' }]
  const response = await makeClientStreamingRequest({
    client,
    fnName: 'sayHelloClientStream',
    payload: names
  })
  assert.ok(response, 'response exists')
  assert.equal(
    response.message,
    `Hello ${names.map(({ name }) => name).join(', ')}`,
    'response message is correct'
  )
  assertServerTransaction({ transaction, fnName: 'SayHelloClientStream' })
  assertServerMetrics({ agentMetrics: agent.metrics._metrics, fnName: 'SayHelloClientStream' })
})

test('should add DT headers when `distributed_tracing` is enabled', async (t) => {
  const { agent, client } = t.nr
  let serverTransaction
  let clientTransaction
  agent.on('transactionFinished', (tx) => {
    if (tx.name === getServerTransactionName('SayHelloClientStream')) {
      serverTransaction = tx
    }
  })
  const payload = [{ name: 'dt test' }, { name: 'dt test2' }]
  await helper.runInTransaction(agent, 'web', async (tx) => {
    clientTransaction = tx
    clientTransaction.name = 'clientTransaction'
    await makeClientStreamingRequest({ client, fnName: 'sayHelloClientStream', payload })
    tx.end()
  })

  // TODO: gotta instrument and test event listeners on client streaming
  // payload.forEach(({ name }) => {})

  assertDistributedTracing({ clientTransaction, serverTransaction })
})

test('should not include distributed trace headers when there is no client transaction', async (t) => {
  const { agent, client } = t.nr
  let serverTransaction
  agent.on('transactionFinished', (tx) => {
    serverTransaction = tx
  })
  const payload = [{ name: 'dt test' }, { name: 'dt test2' }]
  await makeClientStreamingRequest({ client, fnName: 'sayHelloClientStream', payload })
  const attributes = serverTransaction.trace.attributes.get(DESTINATION)
  notHas({
    found: attributes,
    doNotWant: 'request.header.newrelic',
    msg: 'should not have newrelic in headers'
  })
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
    if (tx.name === getServerTransactionName('SayHelloClientStream')) {
      serverTransaction = tx
    }
  })

  agent.config.distributed_tracing.enabled = false
  await helper.runInTransaction(agent, 'web', async (tx) => {
    clientTransaction = tx
    clientTransaction.name = 'clientTransaction'
    const payload = [{ name: 'dt test' }, { name: 'dt test2' }]
    await makeClientStreamingRequest({ client, fnName: 'sayHelloClientStream', payload })
    tx.end()
  })

  const attributes = serverTransaction.trace.attributes.get(DESTINATION)
  notHas({
    found: attributes,
    doNotWant: 'request.header.newrelic',
    msg: 'should not have newrelic in headers'
  })
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
    const expectedStatusCode = ERR_CODE
    const expectedStatusText = ERR_SERVER_MSG
    agent.config.grpc.record_errors = config.record_errors
    agent.config.grpc.ignore_status_codes = config.ignore_status_codes
    let transaction
    agent.on('transactionFinished', (tx) => {
      if (tx.name === getServerTransactionName('SayErrorClientStream')) {
        transaction = tx
      }
    })

    try {
      const payload = [{ oh: 'noes' }]
      await makeClientStreamingRequest({ client, fnName: 'sayErrorClientStream', payload })
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
      fnName: 'SayErrorClientStream'
    })
  })
}

test('should not record errors if `grpc.record_errors` is disabled', async (t) => {
  const { agent, client } = t.nr
  agent.config.grpc.record_errors = false

  let transaction
  agent.on('transactionFinished', (tx) => {
    if (tx.name === getServerTransactionName('SayErrorClientStream')) {
      transaction = tx
    }
  })

  try {
    const payload = [{ oh: 'noes' }]
    await makeClientStreamingRequest({ client, fnName: 'sayErrorClientStream', payload })
  } catch {
    // err tested in client tests
  }
  assert.ok(transaction, 'transaction exists')
  assert.equal(agent.errors.traceAggregator.errors.length, 0, 'should not record any errors')
  assertServerTransaction({
    transaction,
    fnName: 'SayErrorClientStream',
    expectedStatusCode: ERR_CODE
  })
  assertServerMetrics({
    agentMetrics: agent.metrics._metrics,
    fnName: 'SayErrorClientStream',
    expectedStatusCode: ERR_CODE
  })
})

test('should record errors if `grpc.record_errors` is enabled and server sends error mid stream', async (t) => {
  const { agent, client } = t.nr
  let transaction
  agent.on('transactionFinished', (tx) => {
    if (tx.name === getServerTransactionName('SayErrorClientStream')) {
      transaction = tx
    }
  })

  try {
    const payload = [{ name: 'error' }]
    await makeClientStreamingRequest({
      client,
      fnName: 'sayErrorClientStream',
      payload,
      endStream: false
    })
  } catch {
    // err tested in client tests
  }
  assert.ok(transaction, 'transaction exists')
  assert.equal(agent.errors.traceAggregator.errors.length, 1, 'should record a single error')
  const error = agent.errors.traceAggregator.errors[0][2]
  assert.equal(error, HALT_GRPC_SERVER_MSG, 'should have the error message')
  assertServerTransaction({
    transaction,
    fnName: 'SayErrorClientStream',
    expectedStatusCode: HALT_CODE
  })
  assertServerMetrics({
    agentMetrics: agent.metrics._metrics,
    fnName: 'SayErrorClientStream',
    expectedStatusCode: HALT_CODE
  })
})
