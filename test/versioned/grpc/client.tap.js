/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const protoLoader = require('@grpc/proto-loader')

const helper = require('../../lib/agent_helper')

const PROTO_PATH = `${__dirname}/example.proto`
const {
  assertExternalSegment,
  assertMetricsNotExisting,
  makeUnaryRequest,
  makeClientStreamingRequest,
  makeServerStreamingRequest,
  makeBidiStreamingRequest,
  getServer,
  getClient
} = require('./util')

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
})

tap.test('grpc client instrumentation', (t) => {
  t.autoend()

  let agent
  let client
  let server
  let proto
  let grpc

  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()
    grpc = require('@grpc/grpc-js')
    proto = grpc.loadPackageDefinition(packageDefinition).helloworld
    server = await getServer(grpc, proto)
    client = getClient(grpc, proto)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    server.forceShutdown()
    client.close()
    grpc = null
    proto = null
  })

  t.test('should track unary client requests as an external when in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        assertExternalSegment({ t, tx: transaction, fnName: 'SayHello' })
      })

      const response = await makeUnaryRequest({
        client,
        fnName: 'sayHello',
        payload: { name: 'New Relic' }
      })
      t.ok(response, 'response exists')
      t.equal(response.message, 'Hello New Relic', 'response message is correct')
      tx.end()
    })
  })

  t.test('should track client streaming requests as an external when in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        assertExternalSegment({ t, tx: transaction, fnName: 'SayHelloClientStream' })
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

  t.test('should track server streaming requests as an external when in a transaction', (t) => {
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        assertExternalSegment({ t, tx: transaction, fnName: 'SayHelloServerStream' })
      })

      const names = ['Moe', 'Larry', 'Curly']
      const responses = await makeServerStreamingRequest({
        client,
        fnName: 'sayHelloServerStream',
        payload: { name: names }
      })
      names.forEach((name, i) => {
        t.equal(responses[i], `Hello ${name}`, 'response stream message should be correct')
      })
      tx.end()
    })
  })

  t.test(
    'should track bidirectional streaming requests as an external when in a transaction',
    (t) => {
      helper.runInTransaction(agent, 'web', async (tx) => {
        agent.on('transactionFinished', (transaction) => {
          assertExternalSegment({ t, tx: transaction, fnName: 'SayHelloBidiStream' })
        })

        const names = [{ name: 'Huey' }, { name: 'Dewey' }, { name: 'Louie' }]
        const responses = await makeBidiStreamingRequest({
          client,
          fnName: 'sayHelloBidiStream',
          payload: names
        })
        names.forEach(({ name }, i) => {
          t.equal(responses[i], `Hello ${name}`, 'response stream message should be correct')
        })

        tx.end()
      })
    }
  )

  t.test('should include distributed trace headers when enabled', (t) => {
    helper.runInTransaction(agent, 'dt-test', async (tx) => {
      const payload = { name: 'dt test' }
      await makeUnaryRequest({ client, fnName: 'sayHello', payload })
      const dtMeta = server.metadataMap.get(payload.name)
      t.match(
        dtMeta.get('traceparent')[0],
        /^[\w\d\-]{55}$/,
        'should have traceparent in server metadata'
      )
      t.equal(dtMeta.get('newrelic')[0], '', 'should have newrelic in server metadata')
      tx.end()
      t.end()
    })
  })

  t.test('should not include distributed trace headers when not in transaction', async (t) => {
    const payload = { name: 'dt not in transaction' }
    await makeUnaryRequest({ client, fnName: 'sayHello', payload })
    const dtMeta = server.metadataMap.get(payload.name)
    t.notOk(dtMeta.has('traceparent'), 'should not have traceparent in server metadata')
    t.notOk(dtMeta.has('newrelic'), 'should not have newrelic in server metadata')
  })

  t.test(
    'should not include distributed trace headers when distributed_tracing.enabled is set to false',
    (t) => {
      agent.config.distributed_tracing.enabled = false
      helper.runInTransaction(agent, 'dt-test', async (tx) => {
        const payload = { name: 'dt disabled' }
        await makeUnaryRequest({ client, payload, fnName: 'sayHello' })
        const dtMeta = server.metadataMap.get(payload.name)
        t.notOk(dtMeta.has('traceparent'), 'should not have traceparent in server metadata')
        t.notOk(dtMeta.has('newrelic'), 'should not have newrelic in server metadata')
        tx.end()
        t.end()
      })
    }
  )

  t.test('should not track external unary client requests outside of a transaction', async (t) => {
    const payload = { name: 'New Relic' }
    const response = await makeUnaryRequest({ client, fnName: 'sayHello', payload })
    t.ok(response, 'response exists')
    t.equal(response.message, 'Hello New Relic', 'response message is correct')
    assertMetricsNotExisting({ t, agent })
  })

  t.test('should record errors in a transaction', (t) => {
    const expectedStatusText = 'i think i will cause problems on purpose'
    const expectedStatusCode = grpc.status.FAILED_PRECONDITION
    helper.runInTransaction(agent, 'web', async (tx) => {
      agent.on('transactionFinished', (transaction) => {
        t.equal(agent.errors.traceAggregator.errors.length, 1, 'should record a single error')
        const error = agent.errors.traceAggregator.errors[0][2]
        t.equal(error, expectedStatusText, 'should have the error message')
        assertExternalSegment({
          t,
          tx: transaction,
          fnName: 'SayError',
          expectedStatusText,
          expectedStatusCode
        })
      })

      try {
        const payload = { oh: 'noes' }
        await makeUnaryRequest({ client, fnName: 'sayError', payload })
      } catch (err) {
        t.ok(err, 'should get an error')
        t.equal(err.code, expectedStatusCode, 'should get the right status code')
        t.equal(err.details, expectedStatusText, 'should get the correct error message')
        tx.end()
      }
    })
  })
})
