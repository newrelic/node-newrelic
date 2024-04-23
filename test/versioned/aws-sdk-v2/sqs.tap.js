/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const AWS_REGION = 'us-east-1'

tap.test('SQS API', (t) => {
  t.autoend()

  let sendMessageRequestId = null
  let sendMessageBatchRequestId = null
  let receiveMessageRequestId = null

  t.beforeEach(async (t) => {
    const server = createResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    const endpoint = `http://localhost:${server.address().port}`
    t.context.sqs = new AWS.SQS({
      credentials: FAKE_CREDENTIALS,
      endpoint: endpoint,
      apiVersion: '2012-11-05',
      region: AWS_REGION
    })

    t.context.queueName = 'delete-aws-sdk-test-queue-' + Math.floor(Math.random() * 100000)
  })

  t.afterEach((t) => {
    t.context.server.close()
    helper.unloadAgent(t.context.agent)
  })

  t.test('commands with callback', (t) => {
    const { agent, queueName, sqs } = t.context
    const createParams = getCreateParams(queueName)
    sqs.createQueue(createParams, function (createErr, createData) {
      t.error(createErr)

      const queueUrl = createData.QueueUrl

      helper.runInTransaction(agent, (transaction) => {
        const sendMessageParams = getSendMessageParams(queueUrl)
        sqs.sendMessage(sendMessageParams, function sendMessageCb(sendErr, sendData) {
          t.error(sendErr)
          t.ok(sendData.MessageId)

          sendMessageRequestId = this.requestId

          const sendMessageBatchParams = getSendMessageBatchParams(queueUrl)
          sqs.sendMessageBatch(
            sendMessageBatchParams,
            function sendBatchCb(sendBatchErr, sendBatchData) {
              t.error(sendBatchErr)
              t.ok(sendBatchData.Successful)

              sendMessageBatchRequestId = this.requestId

              const receiveMessageParams = getReceiveMessageParams(queueUrl)
              sqs.receiveMessage(
                receiveMessageParams,
                function receiveMsgCb(receiveErr, receiveData) {
                  t.error(receiveErr)
                  t.ok(receiveData.Messages)

                  receiveMessageRequestId = this.requestId

                  transaction.end()

                  const args = { t, transaction, queueName }
                  setImmediate(finish, args)
                }
              )
            }
          )
        })
      })
    })
  })

  t.test('commands with promises', (t) => {
    const { agent, queueName, sqs } = t.context
    const createParams = getCreateParams(queueName)
    sqs.createQueue(createParams, function (createErr, createData) {
      t.error(createErr)

      const queueUrl = createData.QueueUrl

      helper.runInTransaction(agent, async (transaction) => {
        try {
          const sendMessageParams = getSendMessageParams(queueUrl)
          const sendData = await sqs.sendMessage(sendMessageParams).promise()
          t.ok(sendData.MessageId)

          sendMessageRequestId = getRequestId(sendData)
        } catch (error) {
          t.error(error)
        }

        try {
          const sendMessageBatchParams = getSendMessageBatchParams(queueUrl)
          const sendBatchData = await sqs.sendMessageBatch(sendMessageBatchParams).promise()
          t.ok(sendBatchData.Successful)

          sendMessageBatchRequestId = getRequestId(sendBatchData)
        } catch (error) {
          t.error(error)
        }

        try {
          const receiveMessageParams = getReceiveMessageParams(queueUrl)
          const receiveData = await sqs.receiveMessage(receiveMessageParams).promise()
          t.ok(receiveData.Messages)

          receiveMessageRequestId = getRequestId(receiveData)
        } catch (error) {
          t.error(error)
        }

        transaction.end()

        const args = { t, transaction, queueName }
        setImmediate(finish, args)
      })
    })
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
    checkAttributes(t, sendMessage, 'sendMessage', sendMessageRequestId)

    checkName(t, sendMessageBatch.name, 'Produce', queueName)
    checkAttributes(t, sendMessageBatch, 'sendMessageBatch', sendMessageBatchRequestId)

    checkName(t, receiveMessage.name, 'Consume', queueName)
    checkAttributes(t, receiveMessage, 'receiveMessage', receiveMessageRequestId)

    t.end()
  }
})

function checkName(t, name, action, queueName) {
  const specificName = `/${action}/Named/${queueName}`

  t.match(name, specificName, 'should have correct name')
}

function checkAttributes(t, segment, operation, expectedRequestId) {
  const actualAttributes = segment.attributes.get(common.SEGMENT_DESTINATION)

  const expectedAttributes = {
    'aws.operation': operation,
    'aws.requestId': expectedRequestId,
    'aws.service': 'Amazon SQS',
    'aws.region': AWS_REGION
  }

  t.match(actualAttributes, expectedAttributes, `should have expected attributes for ${operation}`)
}

function getRequestId(data) {
  return data?.$response?.requestId
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
