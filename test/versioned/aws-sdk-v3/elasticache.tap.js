/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('./common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('ElastiCacheClient', (t) => {
  t.beforeEach(async (t) => {
    const server = createResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const { ElastiCacheClient, ...lib } = require('@aws-sdk/client-elasticache')
    t.context.AddTagsToResourceCommand = lib.AddTagsToResourceCommand
    const endpoint = `http://localhost:${server.address().port}`
    t.context.service = new ElastiCacheClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
  })

  t.test('AddTagsToResourceCommand', (t) => {
    const { agent, service, AddTagsToResourceCommand } = t.context
    helper.runInTransaction(agent, async (tx) => {
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
  t.end()
})
