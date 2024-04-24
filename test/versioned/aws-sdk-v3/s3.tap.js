/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('S3 buckets', (t) => {
  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const { S3Client, ...lib } = require('@aws-sdk/client-s3')
    t.context.client = new S3Client({
      region: 'us-east-1',
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      // allows using generic endpoint, instead of needing a
      // bucket.endpoint server setup.
      forcePathStyle: true
    })

    t.context.lib = lib
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
  })

  t.test('commands', (t) => {
    const {
      client,
      agent,
      lib: { HeadBucketCommand, CreateBucketCommand, DeleteBucketCommand }
    } = t.context
    const Bucket = 'delete-aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)

    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.send(new HeadBucketCommand({ Bucket }))
        await client.send(new CreateBucketCommand({ Bucket }))
        await client.send(new DeleteBucketCommand({ Bucket }))
      } catch (err) {
        t.error(err)
      }

      tx.end()

      const args = {
        tx,
        service: 'S3',
        operations: ['HeadBucketCommand', 'CreateBucketCommand', 'DeleteBucketCommand']
      }
      setImmediate(t.checkExternals, args)
    })
  })
  t.end()
})
