/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('RDSClient', (t) => {
  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const { RDSClient, ...lib } = require('@aws-sdk/client-rds')
    t.context.AddRoleToDBClusterCommand = lib.AddRoleToDBClusterCommand
    const endpoint = `http://localhost:${server.address().port}`
    t.context.service = new RDSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
  })

  t.test('AddRoleToDBClusterCommand', (t) => {
    const { service, agent, AddRoleToDBClusterCommand } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new AddRoleToDBClusterCommand({
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
      setImmediate(t.checkExternals, {
        service: 'RDS',
        operations: ['AddRoleToDBClusterCommand'],
        tx
      })
    })
  })
  t.end()
})
