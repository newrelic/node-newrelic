/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { ERR_CODE, ERR_MSG } = require('./constants')

const {
  assertExternalSegment,
  assertMetricsNotExisting,
  makeClientStreamingRequest,
  createServer,
  getClient
} = require('./util')

tap.test('gRPC Client: Client Streaming', (t) => {
  t.autoend()

  let agent
  let client
  let server
  let proto
  let grpc

  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()
    grpc = require('@grpc/grpc-js')
    const data = await createServer(grpc)
    proto = data.proto
    server = data.server
    client = getClient(grpc, proto)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    server.forceShutdown()
    client.close()
    grpc = null
    proto = null
  })

  t.test('should track client streaming requests as an external when in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        assertExternalSegment({ t, tx: transaction, fnName: 'SayHelloClientStream' })
        t.end()
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
      tx.end()
    })
  })

  t.test('should include distributed trace headers when enabled', (t) => {
    helper.runInTransaction(agent, 'dt-test', async (tx) => {
      const payload = [{ name: 'dt test' }, { name: 'dt test2' }]
      await makeClientStreamingRequest({ client, fnName: 'sayHelloClientStream', payload })
      payload.forEach(({ name }) => {
        const dtMeta = server.metadataMap.get(name)
        t.match(
          dtMeta.get('traceparent')[0],
          /^[\w\d\-]{55}$/,
          'should have traceparent in server metadata'
        )
        t.equal(dtMeta.get('newrelic')[0], '', 'should have newrelic in server metadata')
      })
      tx.end()
      t.end()
    })
  })

  t.test('should not include distributed trace headers when not in transaction', async (t) => {
    const payload = [{ name: 'dt not in transaction' }]
    await makeClientStreamingRequest({ client, fnName: 'sayHelloClientStream', payload })
    const dtMeta = server.metadataMap.get(payload[0].name)
    t.notOk(dtMeta.has('traceparent'), 'should not have traceparent in server metadata')
    t.notOk(dtMeta.has('newrelic'), 'should not have newrelic in server metadata')
  })

  t.test(
    'should not include distributed trace headers when distributed_tracing.enabled is set to false',
    (t) => {
      agent.config.distributed_tracing.enabled = false
      helper.runInTransaction(agent, 'dt-test', async (tx) => {
        const payload = [{ name: 'dt disabled' }]
        await makeClientStreamingRequest({ client, fnName: 'sayHelloClientStream', payload })
        const dtMeta = server.metadataMap.get(payload[0].name)
        t.notOk(dtMeta.has('traceparent'), 'should not have traceparent in server metadata')
        t.notOk(dtMeta.has('newrelic'), 'should not have newrelic in server metadata')
        tx.end()
        t.end()
      })
    }
  )

  t.test('should not track client streaming requests outside of a transaction', async (t) => {
    const payload = [{ name: 'New Relic' }]
    const response = await makeClientStreamingRequest({
      client,
      fnName: 'sayHelloClientStream',
      payload
    })
    t.ok(response, 'response exists')
    t.equal(response.message, 'Hello New Relic', 'response message is correct')
    assertMetricsNotExisting({ t, agent })
    t.end()
  })

  t.test('should record errors in a transaction', (t) => {
    const expectedStatusText = ERR_MSG
    const expectedStatusCode = ERR_CODE
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        t.equal(agent.errors.traceAggregator.errors.length, 1, 'should record a single error')
        const error = agent.errors.traceAggregator.errors[0][2]
        t.equal(error, expectedStatusText, 'should have the error message')
        assertExternalSegment({
          t,
          tx: transaction,
          fnName: 'SayErrorClientStream',
          expectedStatusText,
          expectedStatusCode
        })
        t.end()
      })

      try {
        const payload = [{ oh: 'noes' }]
        await makeClientStreamingRequest({ client, fnName: 'sayErrorClientStream', payload })
      } catch (err) {
        t.ok(err, 'should get an error')
        t.equal(err.code, expectedStatusCode, 'should get the right status code')
        t.equal(err.details, expectedStatusText, 'should get the correct error message')
        tx.end()
      }
    })
  })
})
