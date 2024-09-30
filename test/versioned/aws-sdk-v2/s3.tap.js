/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { match } = require('../../lib/custom-assertions')
const promiseResolvers = require('../../lib/promise-resolvers')

test('S3 buckets', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server

    ctx.nr.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    ctx.nr.S3 = new AWS.S3({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      // allows using generic endpoint, instead of needing a
      // bucket.endpoint server setup.
      s3ForcePathStyle: true,
      apiVersion: '2006-03-01'
    })
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('commands with callbacks', (t, end) => {
    const { agent, S3 } = t.nr
    const Bucket = 'delete-aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)

    helper.runInTransaction(agent, (tx) => {
      S3.headBucket({ Bucket }, (err) => {
        assert.ok(!err)

        S3.createBucket({ Bucket }, (err) => {
          assert.ok(!err)

          S3.deleteBucket({ Bucket }, (err) => {
            assert.ok(!err)
            tx.end()

            const args = [end, tx]
            setImmediate(finish, ...args)
          })
        })
      })
    })
  })

  await t.test('commands with promises', async (t) => {
    const { agent, S3 } = t.nr
    const { promise, resolve } = promiseResolvers()
    const Bucket = 'delete-aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)

    helper.runInTransaction(agent, async (tx) => {
      await S3.headBucket({ Bucket }).promise()
      await S3.createBucket({ Bucket }).promise()
      await S3.deleteBucket({ Bucket }).promise()
      tx.end()

      const args = [resolve, tx]
      setImmediate(finish, ...args)
    })
    await promise
  })
})

function finish(end, tx) {
  const externals = common.checkAWSAttributes(tx.trace.root, common.EXTERN_PATTERN)
  assert.equal(externals.length, 3, 'should have 3 aws externals')
  const [head, create, del] = externals
  checkAttrs(head, 'headBucket')
  checkAttrs(create, 'createBucket')
  checkAttrs(del, 'deleteBucket')

  end()
}

function checkAttrs(segment, operation) {
  const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
  assert.equal(
    match(attrs, {
      'aws.operation': operation,
      'aws.requestId': String,
      'aws.service': 'Amazon S3',
      'aws.region': 'us-east-1'
    }),
    true,
    `should have expected attributes for ${operation}`
  )
}
