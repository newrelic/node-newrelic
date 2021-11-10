/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO restore attribute checking, see checkAttributes

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

const AWS_REGION = 'us-east-1'

tap.test('SQS API', (t) => {
  t.autoend()

  let helper = null
  let sqs = null

  let CreateQueueCommand = null
  let SendMessageCommand = null
  let SendMessageBatchCommand = null
  let ReceiveMessageCommand = null

  let queueName = null
  // let sendMessageRequestId = null
  // let sendMessageBatchRequestId = null
  // let receiveMessageRequestId = null

  let server = null

  t.beforeEach(async () => {
    server = createResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: '@aws-sdk/client-sqs',
      type: 'message',
      onRequire: require('../../../lib/v3-sqs')
    })

    const lib = require('@aws-sdk/client-sqs')
    const SQSClient = lib.SQSClient
    CreateQueueCommand = lib.CreateQueueCommand
    SendMessageCommand = lib.SendMessageCommand
    SendMessageBatchCommand = lib.SendMessageBatchCommand
    ReceiveMessageCommand = lib.ReceiveMessageCommand

    sqs = new SQSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: AWS_REGION
    })

    queueName = 'delete-aws-sdk-test-queue-' + Math.floor(Math.random() * 100000)
  })

  t.afterEach(() => {
    helper && helper.unload()

    server.close()
    server = null

    helper = null
    sqs = null

    CreateQueueCommand = null
    SendMessageCommand = null
    SendMessageBatchCommand = null

    queueName = null
    // sendMessageRequestId = null
    // sendMessageBatchRequestId = null
    // receiveMessageRequestId = null
  })

  t.test('commands with promises', async (t) => {
    // create queue
    const createParams = getCreateParams(queueName)
    const createCommand = new CreateQueueCommand(createParams)
    let QueueUrl
    try {
      const createData = await sqs.send(createCommand)
      QueueUrl = createData.QueueUrl
    } catch (err) {
      t.error(err)
    }
    t.ok(QueueUrl)
    // run send/receive commands in transaction
    await helper.runInTransaction(async (transaction) => {
      // send message
      const sendMessageParams = getSendMessageParams(QueueUrl)
      const sendMessageCommand = new SendMessageCommand(sendMessageParams)
      let sendMessageData = null
      let MessageId = null
      try {
        sendMessageData = await sqs.send(sendMessageCommand)
        MessageId = sendMessageData.MessageId
      } catch (err) {
        t.error(err)
      }
      t.ok(MessageId)
      // send message batch
      const sendMessageBatchParams = getSendMessageBatchParams(QueueUrl)
      const sendMessageBatchCommand = new SendMessageBatchCommand(sendMessageBatchParams)
      let sendMessageBatchData = null
      let Successful = null
      try {
        sendMessageBatchData = await sqs.send(sendMessageBatchCommand)
        Successful = sendMessageBatchData.Successful
      } catch (err) {
        t.error(err)
      }
      t.ok(Successful)
      // receive message
      const receiveMessageParams = getReceiveMessageParams(QueueUrl)
      const receiveMessageCommand = new ReceiveMessageCommand(receiveMessageParams)
      let receiveMessageData = null
      let Messages = null
      try {
        receiveMessageData = await sqs.send(receiveMessageCommand)
        Messages = receiveMessageData.Messages
      } catch (err) {
        t.error(err)
      }
      t.ok(Messages)
      // wrap up
      transaction.end()
      await finish(t, transaction)
    })
  })

  function finish(t, transaction) {
    const expectedSegmentCount = 3

    const root = transaction.trace.root
    const segments = common.checkAWSAttributes(t, root, common.SQS_PATTERN, [], true)

    t.equal(
      segments.length,
      expectedSegmentCount,
      `should have ${expectedSegmentCount} AWS MessageBroker/SQS segments`
    )

    const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN, [], true)
    t.equal(externalSegments.length, 0, 'should not have any External segments')

    const [sendMessage, sendMessageBatch, receiveMessage] = segments

    checkName(t, sendMessage.name, 'Produce', queueName)
    // checkAttributes(t, sendMessage, 'sendMessage', sendMessageRequestId)

    checkName(t, sendMessageBatch.name, 'Produce', queueName)
    // checkAttributes(t, sendMessageBatch, 'sendMessageBatch', sendMessageBatchRequestId)

    checkName(t, receiveMessage.name, 'Consume', queueName)
    // checkAttributes(t, receiveMessage, 'receiveMessage', receiveMessageRequestId)

    t.end()
  }
})

function checkName(t, name, action, queueName) {
  const specificName = `/${action}/Named/${queueName}`

  t.match(name, specificName, 'should have correct name')
}

// function checkAttributes(t, segment, operation, expectedRequestId) {
//   const actualAttributes = segment.attributes.get(common.SEGMENT_DESTINATION)
//
//   const expectedAttributes = {
//     'aws.operation': operation,
//     'aws.requestId': expectedRequestId,
//     'aws.service': 'Amazon SQS',
//     'aws.region': AWS_REGION
//   }
//
//   t.match(
//     actualAttributes,
//     expectedAttributes,
//     `should have expected attributes for ${operation}`
//   )
// }

// function getRequestId(t, apiReturnedData) {
//   const metadata = apiReturnedData['$metadata']
//   t.ok(metadata)
//   return metadata.RequestId
// }

function getCreateParams(queueName) {
  const params = {
    QueueName: queueName,
    Attributes: {
      MessageRetentionPeriod: '1200' // 20 minutes
    }
  }

  return params
}

function getSendMessageParams(queueUrl) {
  const params = {
    MessageAttributes: {
      Attr1: {
        DataType: 'String',
        StringValue: 'One'
      }
    },
    MessageBody: 'This is a test message',
    QueueUrl: queueUrl
  }

  return params
}

function getSendMessageBatchParams(queueUrl) {
  const params = {
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

  return params
}

function getReceiveMessageParams(queueUrl) {
  const params = {
    AttributeNames: ['SentTimestamp'],
    MaxNumberOfMessages: 2,
    MessageAttributeNames: ['All'],
    QueueUrl: queueUrl
  }

  return params
}
