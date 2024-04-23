/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('S3 buckets', (t) => {
  t.autoend()

  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server

    t.context.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    t.context.S3 = new AWS.S3({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      // allows using generic endpoint, instead of needing a
      // bucket.endpoint server setup.
      s3ForcePathStyle: true,
      apiVersion: '2006-03-01'
    })
  })

  t.afterEach((t) => {
    t.context.server.close()
    helper.unloadAgent(t.context.agent)
  })

  t.test('commands with callbacks', (t) => {
    const { agent, S3 } = t.context
    const Bucket = 'delete-aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)

    helper.runInTransaction(agent, (tx) => {
      S3.headBucket({ Bucket }, (err) => {
        t.error(err)

        S3.createBucket({ Bucket }, (err) => {
          t.error(err)

          S3.deleteBucket({ Bucket }, (err) => {
            t.error(err)
            tx.end()

            const args = [t, tx]
            setImmediate(finish, ...args)
          })
        })
      })
    })
  })

  t.test('commands with promises', (t) => {
    const { agent, S3 } = t.context
    const Bucket = 'delete-aws-sdk-test-bucket-' + Math.floor(Math.random() * 100000)

    helper.runInTransaction(agent, async (tx) => {
      try {
        await S3.headBucket({ Bucket }).promise()
      } catch (err) {
        t.error(err)
      }

      try {
        // using pathstyle will result in the params being mutated due to this call,
        // which is why the params are manually pasted in each call.
        await S3.createBucket({ Bucket }).promise()
      } catch (err) {
        t.error(err)
      }

      try {
        await S3.deleteBucket({ Bucket }).promise()
      } catch (err) {
        t.error(err)
      }

      tx.end()

      const args = [t, tx]
      setImmediate(finish, ...args)
    })
  })
})

function finish(t, tx) {
  const externals = common.checkAWSAttributes(t, tx.trace.root, common.EXTERN_PATTERN)
  t.equal(externals.length, 3, 'should have 3 aws externals')
  const [head, create, del] = externals
  checkAttrs(t, head, 'headBucket')
  checkAttrs(t, create, 'createBucket')
  checkAttrs(t, del, 'deleteBucket')

  t.end()
}

function checkAttrs(t, segment, operation) {
  const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
  t.match(
    attrs,
    {
      'aws.operation': operation,
      'aws.requestId': String,
      'aws.service': 'Amazon S3',
      'aws.region': 'us-east-1'
    },
    `should have expected attributes for ${operation}`
  )
}
