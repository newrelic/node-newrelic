/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('RDSClient', (t) => {
  t.autoend()
  let helper = null
  let server = null
  let service = null
  let AddRoleToDBClusterCommand = null

  t.beforeEach(async () => {
    server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    helper = utils.TestAgent.makeInstrumented()
    common.registerCoreInstrumentation(helper)
    const { RDSClient, ...lib } = require('@aws-sdk/client-rds')
    AddRoleToDBClusterCommand = lib.AddRoleToDBClusterCommand
    const endpoint = `http://localhost:${server.address().port}`
    service = new RDSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.destroy()
    helper && helper.unload()
  })

  t.test('AddRoleToDBClusterCommand', (t) => {
    helper.runInTransaction(async (tx) => {
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
      setImmediate(common.checkExternals, {
        t,
        service: 'RDS',
        operations: ['AddRoleToDBClusterCommand'],
        tx
      })
    })
  })
})
