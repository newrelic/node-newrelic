/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('ElasticLoadBalancingClient', (t) => {
  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const { ElasticLoadBalancingClient, ...lib } = require('@aws-sdk/client-elastic-load-balancing')
    t.context.AddTagsCommand = lib.AddTagsCommand
    const endpoint = `http://localhost:${server.address().port}`
    t.context.service = new ElasticLoadBalancingClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
  })

  t.test('AddTagsCommand', (t) => {
    const { agent, service, AddTagsCommand } = t.context
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
      setImmediate(t.checkExternals, {
        service: 'Elastic Load Balancing',
        operations: ['AddTagsCommand'],
        tx
      })
    })
  })
  t.end()
})
