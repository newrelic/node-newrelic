/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('S3 buckets', (t) => {
  t.autoend()

  let helper = null
  let HeadBucketCommand = null
  let CreateBucketCommand = null
  let DeleteBucketCommand = null
  let S3 = null

  let server = null

  t.beforeEach(async () => {
    server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    helper = utils.TestAgent.makeInstrumented()
    common.registerInstrumentation(helper)
    const { S3Client, ...lib } = require('@aws-sdk/client-s3')
    S3 = new S3Client({
      region: 'us-east-1',
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      // allows using generic endpoint, instead of needing a
      // bucket.endpoint server setup.
      forcePathStyle: true
    })

    HeadBucketCommand = lib.HeadBucketCommand
    CreateBucketCommand = lib.CreateBucketCommand
    DeleteBucketCommand = lib.DeleteBucketCommand
  })

  t.afterEach(() => {
    server.destroy()
    server = null

    helper && helper.unload()
  })

  t.test('commands', (t) => {
    const Bucket = 'delete-aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)

    helper.runInTransaction(async (tx) => {
      try {
        await S3.send(new HeadBucketCommand({ Bucket }))
        await S3.send(new CreateBucketCommand({ Bucket }))
        await S3.send(new DeleteBucketCommand({ Bucket }))
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
})
