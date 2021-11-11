/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('ElasticLoadBalancingClient', (t) => {
  t.autoend()
  let helper = null
  let server = null
  let service = null
  let AddTagsCommand = null

  t.beforeEach(async () => {
    server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    helper = utils.TestAgent.makeInstrumented()
    common.registerCoreInstrumentation(helper)
    const { ElasticLoadBalancingClient, ...lib } = require('@aws-sdk/client-elastic-load-balancing')
    AddTagsCommand = lib.AddTagsCommand
    const endpoint = `http://localhost:${server.address().port}`
    service = new ElasticLoadBalancingClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.destroy()
    helper && helper.unload()
  })

  t.test('AddTagsCommand', (t) => {
    helper.runInTransaction(async (tx) => {
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
      setImmediate(common.checkExternals, {
        t,
        service: 'Elastic Load Balancing',
        operations: ['AddTagsCommand'],
        tx
      })
    })
  })
})
