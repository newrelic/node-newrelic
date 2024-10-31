/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { afterEach, checkExternals } = require('./common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

test('RedshiftClient', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const { RedshiftClient, ...lib } = require('@aws-sdk/client-redshift')
    ctx.nr.AcceptReservedNodeExchangeCommand = lib.AcceptReservedNodeExchangeCommand
    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.service = new RedshiftClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(afterEach)

  await t.test('AcceptReservedNodeExchangeCommand', (t, end) => {
    const { agent, service, AcceptReservedNodeExchangeCommand } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new AcceptReservedNodeExchangeCommand({
        ReservedNodeId: 'STRING_VALUE' /* required */,
        TargetReservedNodeOfferingId: 'STRING_VALUE' /* required */
      })
      await service.send(cmd)
      tx.end()
      setImmediate(checkExternals, {
        service: 'Redshift',
        operations: ['AcceptReservedNodeExchangeCommand'],
        tx,
        end
      })
    })
  })
})
