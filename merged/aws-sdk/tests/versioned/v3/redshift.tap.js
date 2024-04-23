/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const common = require('../common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('RedshiftClient', (t) => {
  t.autoend()
  let helper = null
  let server = null
  let service = null
  let AcceptReservedNodeExchangeCommand = null

  t.beforeEach(async () => {
    server = createResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    helper = utils.TestAgent.makeInstrumented()
    common.registerInstrumentation(helper)
    const { RedshiftClient, ...lib } = require('@aws-sdk/client-redshift')
    AcceptReservedNodeExchangeCommand = lib.AcceptReservedNodeExchangeCommand
    const endpoint = `http://localhost:${server.address().port}`
    service = new RedshiftClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.destroy()
    helper && helper.unload()
  })

  t.test('AcceptReservedNodeExchangeCommand', (t) => {
    helper.runInTransaction(async (tx) => {
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
})
