/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('./common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('RedshiftClient', (t) => {
  t.beforeEach(async (t) => {
    const server = createResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const { RedshiftClient, ...lib } = require('@aws-sdk/client-redshift')
    t.context.AcceptReservedNodeExchangeCommand = lib.AcceptReservedNodeExchangeCommand
    const endpoint = `http://localhost:${server.address().port}`
    t.context.service = new RedshiftClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
  })

  t.test('AcceptReservedNodeExchangeCommand', (t) => {
    const { agent, service, AcceptReservedNodeExchangeCommand } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new AcceptReservedNodeExchangeCommand({
        ReservedNodeId: 'STRING_VALUE' /* required */,
        TargetReservedNodeOfferingId: 'STRING_VALUE' /* required */
      })
      await service.send(cmd)
      tx.end()
      setImmediate(t.checkExternals, {
        service: 'Redshift',
        operations: ['AcceptReservedNodeExchangeCommand'],
        tx
      })
    })
  })
  t.end()
})
