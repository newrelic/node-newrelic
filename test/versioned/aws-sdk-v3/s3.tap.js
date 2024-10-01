/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { afterEach, checkExternals } = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

test('S3 buckets', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const { S3Client, ...lib } = require('@aws-sdk/client-s3')
    ctx.nr.client = new S3Client({
      region: 'us-east-1',
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      // allows using generic endpoint, instead of needing a
      // bucket.endpoint server setup.
      forcePathStyle: true
    })

    ctx.nr.lib = lib
  })

  t.afterEach(afterEach)

  await t.test('commands', (t, end) => {
    const {
      client,
      agent,
      lib: { HeadBucketCommand, CreateBucketCommand, DeleteBucketCommand }
    } = t.nr
    const Bucket = 'delete-aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)

    helper.runInTransaction(agent, async (tx) => {
      await client.send(new HeadBucketCommand({ Bucket }))
      await client.send(new CreateBucketCommand({ Bucket }))
      await client.send(new DeleteBucketCommand({ Bucket }))

      tx.end()

      const args = {
        end,
        tx,
        service: 'S3',
        operations: ['HeadBucketCommand', 'CreateBucketCommand', 'DeleteBucketCommand']
      }
      setImmediate(checkExternals, args)
    })
  })
})
