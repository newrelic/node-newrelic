/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { afterEach, checkExternals } = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

test('LambdaClient', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const { LambdaClient, ...lib } = require('@aws-sdk/client-lambda')
    ctx.nr.AddLayerVersionPermissionCommand = lib.AddLayerVersionPermissionCommand
    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.service = new LambdaClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(afterEach)

  await t.test('AddLayerVersionPermissionCommand', (t, end) => {
    const { service, agent, AddLayerVersionPermissionCommand } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new AddLayerVersionPermissionCommand({
        Action: 'lambda:GetLayerVersion' /* required */,
        LayerName: 'STRING_VALUE' /* required */,
        Principal: '*' /* required */,
        StatementId: 'STRING_VALUE' /* required */,
        VersionNumber: 2 /* required */,
        OrganizationId: 'o-0123456789',
        RevisionId: 'STRING_VALUE'
      })
      await service.send(cmd)
      tx.end()
      setImmediate(checkExternals, {
        service: 'Lambda',
        operations: ['AddLayerVersionPermissionCommand'],
        tx,
        end
      })
    })
  })
})
