/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { match } = require('../../lib/custom-assertions')
const promiseResolvers = require('../../lib/promise-resolvers')
const AWS_REGION = 'us-east-1'

test('SQS API', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.sqs = new AWS.SQS({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      apiVersion: '2012-11-05',
      region: AWS_REGION
    })

    ctx.nr.queueName = 'delete-aws-sdk-test-queue-' + Math.floor(Math.random() * 100000)
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('commands with callback', (t, end) => {
    const { agent, queueName, sqs } = t.nr
    const createParams = getCreateParams(queueName)
    let sendMessageRequestId
    let sendMessageBatchRequestId
    let receiveMessageRequestId
    sqs.createQueue(createParams, function (createErr, createData) {
      assert.ok(!createErr)

      const queueUrl = createData.QueueUrl

      helper.runInTransaction(agent, (transaction) => {
        const sendMessageParams = getSendMessageParams(queueUrl)
        sqs.sendMessage(sendMessageParams, function sendMessageCb(sendErr, sendData) {
          assert.ok(!sendErr)
          assert.ok(sendData.MessageId)

          sendMessageRequestId = this.requestId

          const sendMessageBatchParams = getSendMessageBatchParams(queueUrl)
          sqs.sendMessageBatch(
            sendMessageBatchParams,
            function sendBatchCb(sendBatchErr, sendBatchData) {
              assert.ok(!sendBatchErr)
              assert.ok(sendBatchData.Successful)

              sendMessageBatchRequestId = this.requestId

              const receiveMessageParams = getReceiveMessageParams(queueUrl)
              sqs.receiveMessage(
                receiveMessageParams,
                function receiveMsgCb(receiveErr, receiveData) {
                  assert.ok(!receiveErr)
                  assert.ok(receiveData.Messages)

                  receiveMessageRequestId = this.requestId

                  transaction.end()

                  const args = {
                    end,
                    transaction,
                    queueName,
                    sendMessageRequestId,
                    sendMessageBatchRequestId,
                    receiveMessageRequestId
                  }
                  setImmediate(finish, args)
                }
              )
            }
          )
        })
      })
    })
  })

  await t.test('commands with promises', async (t) => {
    const { agent, queueName, sqs } = t.nr
    const { promise, resolve } = promiseResolvers()
    const createParams = getCreateParams(queueName)
    let sendMessageRequestId
    let sendMessageBatchRequestId
    let receiveMessageRequestId
    sqs.createQueue(createParams, function (createErr, createData) {
      assert.ok(!createErr)

      const queueUrl = createData.QueueUrl

      helper.runInTransaction(agent, async (transaction) => {
        const sendMessageParams = getSendMessageParams(queueUrl)
        const sendData = await sqs.sendMessage(sendMessageParams).promise()
        assert.ok(sendData.MessageId)

        sendMessageRequestId = getRequestId(sendData)
        const sendMessageBatchParams = getSendMessageBatchParams(queueUrl)
        const sendBatchData = await sqs.sendMessageBatch(sendMessageBatchParams).promise()
        assert.ok(sendBatchData.Successful)

        sendMessageBatchRequestId = getRequestId(sendBatchData)
        const receiveMessageParams = getReceiveMessageParams(queueUrl)
        const receiveData = await sqs.receiveMessage(receiveMessageParams).promise()
        assert.ok(receiveData.Messages)

        receiveMessageRequestId = getRequestId(receiveData)
        transaction.end()

        const args = {
          end: resolve,
          transaction,
          queueName,
          sendMessageRequestId,
          sendMessageBatchRequestId,
          receiveMessageRequestId
        }
        setImmediate(finish, args)
      })
    })
    await promise
  })
})

function finish({
  end,
  transaction,
  queueName,
  sendMessageRequestId,
  sendMessageBatchRequestId,
  receiveMessageRequestId
}) {
  const expectedSegmentCount = 3

  const root = transaction.trace.root
  const segments = common.checkAWSAttributes(root, common.SQS_PATTERN)

  assert.equal(
    segments.length,
    expectedSegmentCount,
    `should have ${expectedSegmentCount} AWS MessageBroker/SQS segments`
  )

  const externalSegments = common.checkAWSAttributes(root, common.EXTERN_PATTERN)
  assert.equal(externalSegments.length, 0, 'should not have any External segments')

  const [sendMessage, sendMessageBatch, receiveMessage] = segments

  checkName(sendMessage.name, 'Produce', queueName)
  checkAttributes(sendMessage, 'sendMessage', sendMessageRequestId)

  checkName(sendMessageBatch.name, 'Produce', queueName)
  checkAttributes(sendMessageBatch, 'sendMessageBatch', sendMessageBatchRequestId)

  checkName(receiveMessage.name, 'Consume', queueName)
  checkAttributes(receiveMessage, 'receiveMessage', receiveMessageRequestId)

  end()
}

function checkName(name, action, queueName) {
  const specificName = `/${action}/Named/${queueName}`

  match(name, specificName)
}

function checkAttributes(segment, operation, expectedRequestId) {
  const actualAttributes = segment.attributes.get(common.SEGMENT_DESTINATION)

  const expectedAttributes = {
    'aws.operation': operation,
    'aws.requestId': expectedRequestId,
    'aws.service': 'Amazon SQS',
    'aws.region': AWS_REGION
  }

  match(actualAttributes, expectedAttributes)
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
