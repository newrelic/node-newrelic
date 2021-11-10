/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('SESClient', (t) => {
  t.autoend()
  let helper = null
  let server = null
  let service = null
  let SendEmailCommand = null

  t.beforeEach(async () => {
    server = createResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    helper = utils.TestAgent.makeInstrumented()
    common.registerCoreInstrumentation(helper)
    const { SESClient, ...lib } = require('@aws-sdk/client-ses')
    SendEmailCommand = lib.SendEmailCommand
    const endpoint = `http://localhost:${server.address().port}`
    service = new SESClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.close()
    helper && helper.unload()
  })

  t.test('SendEmailCommand', (t) => {
    helper.runInTransaction(async (tx) => {
      const cmd = new SendEmailCommand({
        Destination: 'foo@bar.com',
        Message: 'Hello World',
        Source: 'sender@ses.com'
      })
      await service.send(cmd)
      tx.end()
      setImmediate(common.checkExternals, {
        t,
        service: 'SES',
        operations: ['SendEmailCommand'],
        tx
      })
    })
  })
})
