/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const sinon = require('sinon')

const AWS_REGION = 'us-east-1'

tap.test('SQS API', (t) => {
  t.beforeEach(async (t) => {
    const server = createResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const Shim = require('../../../lib/shim/message-shim')
    t.context.setLibrarySpy = sinon.spy(Shim.prototype, 'setLibrary')
    const lib = require('@aws-sdk/client-sqs')
    const SQSClient = lib.SQSClient
    t.context.lib = lib

    t.context.sqs = new SQSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: AWS_REGION
    })

    t.context.queueName = 'delete-aws-sdk-test-queue-' + Math.floor(Math.random() * 100000)
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
    t.context.setLibrarySpy.restore()
  })

  t.test('commands with promises', async (t) => {
    const {
      agent,
      queueName,
      sqs,
      lib: {
        CreateQueueCommand,
        SendMessageCommand,
        SendMessageBatchCommand,
        ReceiveMessageCommand
      }
    } = t.context
    // create queue
    const createParams = getCreateParams(queueName)
    const createCommand = new CreateQueueCommand(createParams)
    const { QueueUrl } = await sqs.send(createCommand)
    t.ok(QueueUrl)
    // run send/receive commands in transaction
    await helper.runInTransaction(agent, async (transaction) => {
      // send message
      const sendMessageParams = getSendMessageParams(QueueUrl)
      const sendMessageCommand = new SendMessageCommand(sendMessageParams)
      const { MessageId } = await sqs.send(sendMessageCommand)
      t.ok(MessageId)
      // send message batch
      const sendMessageBatchParams = getSendMessageBatchParams(QueueUrl)
      const sendMessageBatchCommand = new SendMessageBatchCommand(sendMessageBatchParams)
      const { Successful } = await sqs.send(sendMessageBatchCommand)
      t.ok(Successful)
      // receive message
      const receiveMessageParams = getReceiveMessageParams(QueueUrl)
      const receiveMessageCommand = new ReceiveMessageCommand(receiveMessageParams)
      const { Messages } = await sqs.send(receiveMessageCommand)
      t.ok(Messages)
      // wrap up
      transaction.end()
      await finish({ t, transaction, queueName })
    })
  })
  t.end()
})

function finish({ t, transaction, queueName }) {
  const expectedSegmentCount = 3

  const root = transaction.trace.root
  const segments = common.checkAWSAttributes(t, root, common.SQS_PATTERN)

  t.equal(
    segments.length,
    expectedSegmentCount,
    `should have ${expectedSegmentCount} AWS MessageBroker/SQS segments`
  )

  const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
  t.equal(externalSegments.length, 0, 'should not have any External segments')

  const [sendMessage, sendMessageBatch, receiveMessage] = segments

  checkName(t, sendMessage.name, 'Produce', queueName)
  checkAttributes(t, sendMessage, 'SendMessageCommand')

  checkName(t, sendMessageBatch.name, 'Produce', queueName)
  checkAttributes(t, sendMessageBatch, 'SendMessageBatchCommand')

  checkName(t, receiveMessage.name, 'Consume', queueName)
  checkAttributes(t, receiveMessage, 'ReceiveMessageCommand')
  t.equal(t.context.setLibrarySpy.callCount, 1, 'should only call setLibrary once and not per call')
}

function checkName(t, name, action, queueName) {
  const specificName = `/${action}/Named/${queueName}`

  t.match(name, specificName, 'should have correct name')
}

function checkAttributes(t, segment, operation) {
  const actualAttributes = segment.attributes.get(common.SEGMENT_DESTINATION)

  const expectedAttributes = {
    'aws.operation': operation,
    'aws.requestId': String,
    'aws.service': /sqs|SQS/,
    'aws.region': AWS_REGION
  }

  t.match(actualAttributes, expectedAttributes, `should have expected attributes for ${operation}`)
}

function getCreateParams(queueName) {
  return {
    QueueName: queueName,
    Attributes: {
      MessageRetentionPeriod: '1200' // 20 minutes
    }
  }
}

function getSendMessageParams(queueUrl) {
  return {
    MessageAttributes: {
      Attr1: {
        DataType: 'String',
        StringValue: 'One'
      }
    },
    MessageBody: 'This is a test message',
    QueueUrl: queueUrl
  }
}

function getSendMessageBatchParams(queueUrl) {
  return {
    Entries: [
      {
        Id: 'ONE',
        MessageBody: 'ONE BODY',
        MessageAttributes: {
          Attribute1: { DataType: 'String', StringValue: 'Value 1' },
          Attribute2: { DataType: 'String', StringValue: 'Value 2' }
        }
      },
      {
        Id: 'TWO',
        MessageBody: 'TWO BODY',
        MessageAttributes: {
          Attribute1: { DataType: 'String', StringValue: 'Value 1' },
          Attribute2: { DataType: 'String', StringValue: 'Value 2' }
        }
      }
    ],
    QueueUrl: queueUrl
  }
}

function getReceiveMessageParams(queueUrl) {
  return {
    AttributeNames: ['SentTimestamp'],
    MaxNumberOfMessages: 2,
    MessageAttributeNames: ['All'],
    QueueUrl: queueUrl
  }
}
