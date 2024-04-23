/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('ElastiCacheClient', (t) => {
  t.autoend()
  let helper = null
  let server = null
  let service = null
  let AddTagsToResourceCommand = null

  t.beforeEach(async () => {
    server = createResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    helper = utils.TestAgent.makeInstrumented()
    common.registerInstrumentation(helper)
    const { ElastiCacheClient, ...lib } = require('@aws-sdk/client-elasticache')
    AddTagsToResourceCommand = lib.AddTagsToResourceCommand
    const endpoint = `http://localhost:${server.address().port}`
    service = new ElastiCacheClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.destroy()
    helper && helper.unload()
  })

  t.test('AddTagsToResourceCommand', (t) => {
    helper.runInTransaction(async (tx) => {
      const cmd = new AddTagsToResourceCommand({
        ResourceName: 'STRING_VALUE' /* required */,
        Tags: [
          /* required */
          {
            Key: 'STRING_VALUE',
            Value: 'STRING_VALUE'
          }
        ]
      })
      await service.send(cmd)
      tx.end()
      setImmediate(t.checkExternals, {
        service: 'ElastiCache',
        operations: ['AddTagsToResourceCommand'],
        tx
      })
    })
  })
})
