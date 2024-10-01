/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { afterEach, checkExternals } = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

test('ElasticLoadBalancingClient', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const { ElasticLoadBalancingClient, ...lib } = require('@aws-sdk/client-elastic-load-balancing')
    ctx.nr.AddTagsCommand = lib.AddTagsCommand
    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.service = new ElasticLoadBalancingClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(afterEach)

  await t.test('AddTagsCommand', (t, end) => {
    const { agent, service, AddTagsCommand } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new AddTagsCommand({
        LoadBalancerNames: ['my-load-balancer'],
        Tags: [
          {
            Key: 'project',
            Value: 'lima'
          },
          {
            Key: 'department',
            Value: 'digital-media'
          }
        ]
      })
      await service.send(cmd)
      tx.end()
      setImmediate(checkExternals, {
        service: 'Elastic Load Balancing',
        operations: ['AddTagsCommand'],
        tx,
        end
      })
    })
  })
})
