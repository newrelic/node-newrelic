/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { afterEach, checkExternals } = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const promiseResolvers = require('../../lib/promise-resolvers')

test('APIGatewayClient', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const { APIGatewayClient, ...lib } = require('@aws-sdk/client-api-gateway')
    ctx.nr.CreateApiKeyCommand = lib.CreateApiKeyCommand
    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.service = new APIGatewayClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(afterEach)

  await t.test('CreateApiKeyCommand', async (t) => {
    const { agent, service, CreateApiKeyCommand } = t.nr
    const { promise, resolve } = promiseResolvers()
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new CreateApiKeyCommand({
        customerId: 'STRING_VALUE',
        description: 'STRING_VALUE',
        enabled: true,
        generateDistinctId: true,
        name: 'STRING_VALUE',
        stageKeys: [
          {
            restApiId: 'STRING_VALUE',
            stageName: 'STRING_VALUE'
          }
        ],
        value: 'STRING_VALUE'
      })
      await service.send(cmd)
      tx.end()
      setImmediate(checkExternals, {
        end: resolve,
        service: 'API Gateway',
        operations: ['CreateApiKeyCommand'],
        tx
      })
    })
    await promise
  })
})
