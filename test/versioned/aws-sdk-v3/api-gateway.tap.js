/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('APIGatewayClient', (t) => {
  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const { APIGatewayClient, ...lib } = require('@aws-sdk/client-api-gateway')
    t.context.CreateApiKeyCommand = lib.CreateApiKeyCommand
    const endpoint = `http://localhost:${server.address().port}`
    t.context.service = new APIGatewayClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
  })

  t.test('CreateApiKeyCommand', (t) => {
    const { agent, service, CreateApiKeyCommand } = t.context
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
      setImmediate(t.checkExternals, {
        service: 'API Gateway',
        operations: ['CreateApiKeyCommand'],
        tx
      })
    })
  })
  t.end()
})
