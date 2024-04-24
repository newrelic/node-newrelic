/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { removeModules } = require('../../lib/cache-buster')
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT
const { ERR_CODE, ERR_SERVER_MSG, HALT_CODE, HALT_GRPC_SERVER_MSG } = require('./constants.cjs')

const {
  makeClientStreamingRequest,
  createServer,
  getClient,
  getServerTransactionName,
  assertError,
  assertServerTransaction,
  assertServerMetrics,
  assertDistributedTracing
} = require('./util.cjs')

tap.test('gRPC Server: Client Streaming', (t) => {
  t.autoend()

  let agent
  let client
  let server
  let proto
  let grpc
  let port

  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()
    grpc = require('@grpc/grpc-js')
    ;({ port, proto, server } = await createServer(grpc))
    client = getClient(grpc, proto, port)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    server.forceShutdown()
    client.close()
    grpc = null
    proto = null
    removeModules(['@grpc/grpc-js'])
  })

  t.test('should track client streaming requests', async (t) => {
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
    t.ok(response, 'response exists')
    t.equal(
      response.message,
      `Hello ${names.map(({ name }) => name).join(', ')}`,
      'response message is correct'
    )
    assertServerTransaction({ t, transaction, fnName: 'SayHelloClientStream' })
    assertServerMetrics({ t, agentMetrics: agent.metrics._metrics, fnName: 'SayHelloClientStream' })
  })

  t.test('should add DT headers when `distributed_tracing` is enabled', async (t) => {
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

    payload.forEach(({ name }) => {
      // TODO: gotta instrument and test event listeners on client streaming
      t.test(`adding '${name}' should create a server trace segment`)
    })
    assertDistributedTracing({ t, clientTransaction, serverTransaction })
    t.end()
  })

  t.test(
    'should not include distributed trace headers when there is no client transaction',
    async (t) => {
      let serverTransaction
      agent.on('transactionFinished', (tx) => {
        serverTransaction = tx
      })
      const payload = [{ name: 'dt test' }, { name: 'dt test2' }]
      await makeClientStreamingRequest({ client, fnName: 'sayHelloClientStream', payload })
      const attributes = serverTransaction.trace.attributes.get(DESTINATION)
      t.notHas(attributes, 'request.header.newrelic', 'should not have newrelic in headers')
      t.notHas(attributes, 'request.header.traceparent', 'should not have traceparent in headers')
    }
  )

  t.test('should not add DT headers when `distributed_tracing` is disabled', async (t) => {
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
    t.notHas(attributes, 'request.header.newrelic', 'should not have newrelic in headers')
    t.notHas(attributes, 'request.header.traceparent', 'should not have traceparent in headers')
    t.end()
  })

  const grpcConfigs = [
    { record_errors: true, ignore_status_codes: [], should: true },
    { record_errors: false, ignore_status_codes: [], should: false },
    { record_errors: true, ignore_status_codes: [9], should: false }
  ]
  grpcConfigs.forEach((config) => {
    const should = config.should ? 'should' : 'should not'
    const testName = `${should} record errors in a transaction when ignoring ${config.ignore_status_codes}`
    t.test(testName, async (t) => {
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
      } catch (err) {
        // err tested in client tests
      }

      assertError({
        t,
        transaction,
        errors: agent.errors,
        agentMetrics: agent.metrics._metrics,
        expectErrors: config.should,
        expectedStatusCode,
        expectedStatusText,
        fnName: 'SayErrorClientStream'
      })
      t.end()
    })
  })

  t.test('should not record errors if `grpc.record_errors` is disabled', async (t) => {
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
    } catch (err) {
      // err tested in client tests
    }
    t.ok(transaction, 'transaction exists')
    t.equal(agent.errors.traceAggregator.errors.length, 0, 'should not record any errors')
    assertServerTransaction({
      t,
      transaction,
      fnName: 'SayErrorClientStream',
      expectedStatusCode: ERR_CODE
    })
    assertServerMetrics({
      t,
      agentMetrics: agent.metrics._metrics,
      fnName: 'SayErrorClientStream',
      expectedStatusCode: ERR_CODE
    })
    t.end()
  })

  t.test(
    'should record errors if `grpc.record_errors` is enabled and server sends error mid stream',
    async (t) => {
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
      } catch (err) {
        // err tested in client tests
      }
      t.ok(transaction, 'transaction exists')
      t.equal(agent.errors.traceAggregator.errors.length, 1, 'should record a single error')
      const error = agent.errors.traceAggregator.errors[0][2]
      t.equal(error, HALT_GRPC_SERVER_MSG, 'should have the error message')
      assertServerTransaction({
        t,
        transaction,
        fnName: 'SayErrorClientStream',
        expectedStatusCode: HALT_CODE
      })
      assertServerMetrics({
        t,
        agentMetrics: agent.metrics._metrics,
        fnName: 'SayErrorClientStream',
        expectedStatusCode: HALT_CODE
      })
      t.end()
    }
  )
})
