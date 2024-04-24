/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('./common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('SESClient', (t) => {
  t.beforeEach(async (t) => {
    const server = createResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const { SESClient, ...lib } = require('@aws-sdk/client-ses')
    t.context.SendEmailCommand = lib.SendEmailCommand
    const endpoint = `http://localhost:${server.address().port}`
    t.context.service = new SESClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
  })

  t.test('SendEmailCommand', (t) => {
    const { agent, service, SendEmailCommand } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new SendEmailCommand({
        Destination: 'foo@bar.com',
        Message: 'Hello World',
        Source: 'sender@ses.com'
      })
      await service.send(cmd)
      tx.end()
      setImmediate(t.checkExternals, {
        service: 'SES',
        operations: ['SendEmailCommand'],
        tx
      })
    })
  })
  t.end()
})
