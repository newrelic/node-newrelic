/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { afterEach, checkExternals } = require('./common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

test('SESClient', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const { SESClient, ...lib } = require('@aws-sdk/client-ses')
    ctx.nr.SendEmailCommand = lib.SendEmailCommand
    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.service = new SESClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(afterEach)

  await t.test('SendEmailCommand', (t, end) => {
    const { agent, service, SendEmailCommand } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new SendEmailCommand({
        Destination: 'foo@bar.com',
        Message: 'Hello World',
        Source: 'sender@ses.com'
      })
      await service.send(cmd)
      tx.end()
      setImmediate(checkExternals, {
        end,
        service: 'SES',
        operations: ['SendEmailCommand'],
        tx
      })
    })
  })
})
