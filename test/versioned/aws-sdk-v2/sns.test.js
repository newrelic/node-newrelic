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
const TopicArn = null

test('SNS', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server

    ctx.nr.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    ctx.nr.sns = new AWS.SNS({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: 'us-east-1'
    })
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('publish with callback', (t, end) => {
    const { agent, sns } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const params = { TopicArn, Message: 'Hello!' }

      sns.publish(params, (err) => {
        assert.ok(!err)
        tx.end()

        const args = [end, tx]
        setImmediate(finish, ...args)
      })
    })
  })

  await t.test('publish with promise', async (t) => {
    const { agent, sns } = t.nr
    const { promise, resolve } = promiseResolvers()
    helper.runInTransaction(agent, async (tx) => {
      const params = { TopicArn, Message: 'Hello!' }

      await sns.publish(params).promise()
      tx.end()

      const args = [resolve, tx]
      setImmediate(finish, ...args)
    })
    await promise
  })
})

function finish(end, tx) {
  const root = tx.trace.root

  const messages = common.checkAWSAttributes(root, common.SNS_PATTERN)
  assert.equal(messages.length, 1, 'should have 1 message broker segment')

  const externalSegments = common.checkAWSAttributes(root, common.EXTERN_PATTERN)
  assert.equal(externalSegments.length, 0, 'should not have any External segments')

  const attrs = messages[0].attributes.get(common.SEGMENT_DESTINATION)
  match(attrs, {
    'aws.operation': 'publish',
    'aws.requestId': String,
    'aws.service': 'Amazon SNS',
    'aws.region': 'us-east-1'
  })
  end()
}
