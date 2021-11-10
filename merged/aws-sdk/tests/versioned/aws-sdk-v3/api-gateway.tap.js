/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('APIGatewayClient', (t) => {
  t.autoend()
  let helper = null
  let server = null
  let service = null
  let CreateApiKeyCommand = null

  t.beforeEach(async () => {
    server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    helper = utils.TestAgent.makeInstrumented()
    common.registerCoreInstrumentation(helper)
    const { APIGatewayClient, ...lib } = require('@aws-sdk/client-api-gateway')
    CreateApiKeyCommand = lib.CreateApiKeyCommand
    const endpoint = `http://localhost:${server.address().port}`
    service = new APIGatewayClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.close()
    helper && helper.unload()
  })

  t.test('CreateApiKeyCommand', (t) => {
    helper.runInTransaction(async (tx) => {
      const cmd = new CreateApiKeyCommand({
        customerId: 'STRING_VALUE',
        description: 'STRING_VALUE',
        enabled: true || false,
        generateDistinctId: true || false,
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
      setImmediate(common.checkExternals, {
        t,
        service: 'API Gateway',
        operations: ['CreateApiKeyCommand'],
        tx
      })
    })
  })
})
