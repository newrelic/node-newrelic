/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const TopicArn = null

tap.test('SNS', (t) => {
  t.autoend()

  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server

    t.context.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    t.context.sns = new AWS.SNS({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: 'us-east-1'
    })
  })

  t.afterEach((t) => {
    t.context.server.close()
    helper.unloadAgent(t.context.agent)
  })

  t.test('publish with callback', (t) => {
    const { agent, sns } = t.context
    helper.runInTransaction(agent, (tx) => {
      const params = { TopicArn, Message: 'Hello!' }

      sns.publish(params, (err) => {
        t.error(err)
        tx.end()

        const args = [t, tx]
        setImmediate(finish, ...args)
      })
    })
  })

  t.test('publish with promise', (t) => {
    const { agent, sns } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const params = { TopicArn, Message: 'Hello!' }

      try {
        await sns.publish(params).promise()
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const args = [t, tx]
      setImmediate(finish, ...args)
    })
  })
})

function finish(t, tx) {
  const root = tx.trace.root

  const messages = common.checkAWSAttributes(t, root, common.SNS_PATTERN)
  t.equal(messages.length, 1, 'should have 1 message broker segment')

  const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
  t.equal(externalSegments.length, 0, 'should not have any External segments')

  const attrs = messages[0].attributes.get(common.SEGMENT_DESTINATION)
  t.match(
    attrs,
    {
      'aws.operation': 'publish',
      'aws.requestId': String,
      'aws.service': 'Amazon SNS',
      'aws.region': 'us-east-1'
    },
    'should have expected attributes for publish'
  )

  t.end()
}
