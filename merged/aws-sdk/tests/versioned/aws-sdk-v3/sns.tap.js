/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('SNS', (t) => {
  t.autoend()

  let helper = null
  let sns = null
  let PublishCommand = null
  let ListTopicsCommand = null

  let server = null

  t.beforeEach(async () => {
    server = createResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: '@aws-sdk/client-sns',
      type: 'message',
      onRequire: require('../../../lib/v3-sns')
    })
    const lib = require('@aws-sdk/client-sns')
    const SNSClient = lib.SNSClient
    PublishCommand = lib.PublishCommand
    ListTopicsCommand = lib.ListTopicsCommand

    sns = new SNSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.close()
    server = null

    helper && helper.unload()
  })

  t.test('publish with default destination(PhoneNumber)', (t) => {
    helper.runInTransaction(async (tx) => {
      const params = { Message: 'Hello!' }

      try {
        const cmd = new PublishCommand(params)
        await sns.send(cmd)
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const destName = 'PhoneNumber'
      const args = [t, tx, destName]
      setImmediate(finish, ...args)
    })
  })

  t.test('publish with TopicArn as destination', (t) => {
    helper.runInTransaction(async (tx) => {
      const TopicArn = 'TopicArn'
      const params = { TopicArn, Message: 'Hello!' }

      try {
        const cmd = new PublishCommand(params)
        await sns.send(cmd)
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const args = [t, tx, TopicArn]
      setImmediate(finish, ...args)
    })
  })

  t.test('publish with TargetArn as destination', (t) => {
    helper.runInTransaction(async (tx) => {
      const TargetArn = 'TargetArn'
      const params = { TargetArn, Message: 'Hello!' }

      try {
        const cmd = new PublishCommand(params)
        await sns.send(cmd)
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const args = [t, tx, TargetArn]
      setImmediate(finish, ...args)
    })
  })

  t.test('publish with TopicArn as destination when both Topic and Target Arn are defined', (t) => {
    helper.runInTransaction(async (tx) => {
      const TargetArn = 'TargetArn'
      const TopicArn = 'TopicArn'
      const params = { TargetArn, TopicArn, Message: 'Hello!' }

      try {
        const cmd = new PublishCommand(params)
        await sns.send(cmd)
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const args = [t, tx, TopicArn]
      setImmediate(finish, ...args)
    })
  })

  t.test(
    'should recored external segment and not a SNS segmetn for a command that is not PublishCommand',
    (t) => {
      helper.runInTransaction(async (tx) => {
        const TargetArn = 'TargetArn'
        const TopicArn = 'TopicArn'
        const params = { TargetArn, TopicArn, Message: 'Hello!' }

        try {
          const cmd = new ListTopicsCommand(params)
          await sns.send(cmd)
        } catch (error) {
          t.error(error)
        }

        tx.end()

        setImmediate(function () {
          const root = tx.trace.root
          const externalSegments = common.checkAWSAttributes(
            t,
            root,
            common.EXTERN_PATTERN,
            [],
            true
          )
          t.equal(externalSegments.length, 1, 'should have an external segment')
          t.end()
        })
      })
    }
  )
})

function finish(t, tx, destName) {
  const root = tx.trace.root

  const messages = common.checkAWSAttributes(t, root, common.SNS_PATTERN, [], true)
  t.equal(messages.length, 1, 'should have 1 message broker segment')
  t.ok(messages[0].name.endsWith(destName), 'should have appropriate destination')

  const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
  t.equal(externalSegments.length, 0, 'should not have any External segments')

  // TODO will have these once the core v3 instrumentation is wired up
  /* const attrs = messages[0].attributes.get(common.SEGMENT_DESTINATION)
  t.matches(
    attrs,
    {
      'aws.operation': 'publish',
      'aws.requestId': String,
      'aws.service': 'Amazon SNS',
      'aws.region': 'us-east-1'
    },
    'should have expected attributes for publish'
  )*/

  t.end()
}
