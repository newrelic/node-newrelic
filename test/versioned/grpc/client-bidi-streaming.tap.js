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
  makeBidiStreamingRequest,
  createServer,
  getClient
} = require('./util')

tap.test('gRPC Client: Bidi Streaming', (t) => {
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

  t.test(
    'should track bidirectional streaming requests as an external when in a transaction',
    (t) => {
      helper.runInTransaction(agent, 'web', async (tx) => {
        agent.on('transactionFinished', (transaction) => {
          assertExternalSegment({ t, tx: transaction, fnName: 'SayHelloBidiStream' })
          t.end()
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
      const payload = [{ name: 'dt test' }]
      await makeBidiStreamingRequest({
        client,
        fnName: 'sayHelloBidiStream',
        payload
      })
      const dtMeta = server.metadataMap.get(payload[0].name)
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
    const payload = [{ name: 'dt not in transaction' }]
    await makeBidiStreamingRequest({
      client,
      fnName: 'sayHelloBidiStream',
      payload
    })
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
        await makeBidiStreamingRequest({
          client,
          fnName: 'sayHelloBidiStream',
          payload
        })
        const dtMeta = server.metadataMap.get(payload[0].name)
        t.notOk(dtMeta.has('traceparent'), 'should not have traceparent in server metadata')
        t.notOk(dtMeta.has('newrelic'), 'should not have newrelic in server metadata')
        tx.end()
        t.end()
      })
    }
  )

  t.test(
    'should not track external bidi streaming client requests outside of a transaction',
    async (t) => {
      const payload = [{ name: 'Moe' }, { name: 'Larry' }, { name: 'Curly' }]
      const responses = await makeBidiStreamingRequest({
        client,
        fnName: 'sayHelloBidiStream',
        payload
      })
      payload.forEach(({ name }, i) => {
        t.equal(responses[i], `Hello ${name}`, 'response stream message should be correct')
      })
      assertMetricsNotExisting({ t, agent })
      t.end()
    }
  )

  t.test('should record errors in a bidi stream transaction', (t) => {
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
          fnName: 'SayErrorBidiStream',
          expectedStatusText,
          expectedStatusCode
        })
        t.end()
      })

      try {
        const payload = [{ name: 'server-error' }]
        await makeBidiStreamingRequest({ client, fnName: 'sayErrorBidiStream', payload })
      } catch (err) {
        t.ok(err, 'should get an error')
        t.equal(err.code, expectedStatusCode, 'should get the right status code')
        t.equal(err.details, expectedStatusText, 'should get the correct error message')
        tx.end()
      }
    })
  })
})
