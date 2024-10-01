/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { afterEach, checkExternals } = require('./common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

test('ElastiCacheClient', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const { ElastiCacheClient, ...lib } = require('@aws-sdk/client-elasticache')
    ctx.nr.AddTagsToResourceCommand = lib.AddTagsToResourceCommand
    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.service = new ElastiCacheClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(afterEach)

  await t.test('AddTagsToResourceCommand', (t, end) => {
    const { agent, service, AddTagsToResourceCommand } = t.nr
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
      setImmediate(checkExternals, {
        service: 'ElastiCache',
        operations: ['AddTagsToResourceCommand'],
        tx,
        end
      })
    })
  })
})
