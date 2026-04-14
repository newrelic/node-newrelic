/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')

const helper = require('../../lib/agent_helper')
const awsEcho = require('./test-utils/aws-echo.js')
const checkAWSAttributes = require('./test-utils/check-aws-attributes.js')
const afterEach = require('./test-utils/after-each.js')
const {
  EXTERN_PATTERN,
  SEGMENT_DESTINATION,
  SQS_PATTERN
} = require('./test-utils/constants.js')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { match } = require('../../lib/custom-assertions')

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
    const lib = require('@aws-sdk/client-sqs')
    const SQSClient = lib.SQSClient
    ctx.nr.lib = lib

    ctx.nr.sqs = new SQSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://sqs.${AWS_REGION}.amazonaws.com:${server.address().port}`,
      region: AWS_REGION
    })

    ctx.nr.queueName = 'delete-aws-sdk-test-queue-' + Math.floor(Math.random() * 100000)

    // Loading `node:http` after the agent has been setup in order to have
    // it instrumented.
    ctx.nr.http = require('node:http')
  })

  t.afterEach((ctx) => {
    afterEach(ctx)
  })

  await t.test('commands with promises', async (t) => {
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
    } = t.nr
    // create queue
    const createParams = getCreateParams(queueName)
    const createCommand = new CreateQueueCommand(createParams)
    const { QueueUrl } = await sqs.send(createCommand)
    assert.ok(QueueUrl)
    // run send/receive commands in transaction
    await helper.runInTransaction(agent, async (transaction) => {
      // send message
      const sendMessageParams = getSendMessageParams(QueueUrl)
      const sendMessageCommand = new SendMessageCommand(sendMessageParams)
      const { MessageId } = await sqs.send(sendMessageCommand)
      assert.ok(MessageId)
      // send message batch
      const sendMessageBatchParams = getSendMessageBatchParams(QueueUrl)
      const sendMessageBatchCommand = new SendMessageBatchCommand(sendMessageBatchParams)
      const { Successful } = await sqs.send(sendMessageBatchCommand)
      assert.ok(Successful)
      // receive message
      const receiveMessageParams = getReceiveMessageParams(QueueUrl)
      const receiveMessageCommand = new ReceiveMessageCommand(receiveMessageParams)
      const { Messages } = await sqs.send(receiveMessageCommand)
      assert.ok(Messages)
      // wrap up
      transaction.end()
      await finish({ transaction, queueName })
    })
  })

  await t.test('attaches distributed trace headers when sending messages', async (t) => {
    const { http, lib, queueName, sqs } = t.nr

    const createPrams = getCreateParams(queueName)
    const createCommand = new lib.CreateQueueCommand(createPrams)
    const { QueueUrl } = await sqs.send(createCommand)
    const { server, address } = await awsEcho({
      http,
      awsClient: sqs,
      cmd: getSendMessageParams(QueueUrl),
      CreateCommand: lib.SendMessageCommand
    })
    t.after(() => {
      server.close()
    })

    const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
    const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`
    const response = await helper.asyncHttpCall(address, {
      headers: { traceparent, tracestate }
    })
    const nrData = response.body.nrSendCommand
    assert.equal(
      nrData.MessageAttributes.traceparent.StringValue.startsWith(traceparent.slice(0, 35)),
      true
    )
    assert.deepEqual(nrData.MessageAttributes.tracestate, {
      DataType: 'String',
      StringValue: tracestate
    })
  })

  await t.test('does not attach distributed trace headers when disabled', async (t) => {
    const { agent, http, lib, queueName, sqs } = t.nr
    agent.config.distributed_tracing.enabled = false

    const createPrams = getCreateParams(queueName)
    const createCommand = new lib.CreateQueueCommand(createPrams)
    const { QueueUrl } = await sqs.send(createCommand)
    const { server, address } = await awsEcho({
      http,
      awsClient: sqs,
      cmd: getSendMessageParams(QueueUrl),
      CreateCommand: lib.SendMessageCommand
    })
    t.after(() => {
      server.close()
    })

    const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
    const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`
    const response = await helper.asyncHttpCall(address, {
      headers: { traceparent, tracestate }
    })
    const nrData = response.body.nrSendCommand
    assert.equal(nrData.MessageAttributes.traceparent, undefined)
    assert.equal(nrData.MessageAttributes.tracestate, undefined)
  })

  await t.test('accepts distributed trace headers', async (t) => {
    // The mock SQS server sends responses that include pre-defined
    // distributed trace headers embedded in the SQS message. This test
    // verifies that our instrumentation picks up those DT headers and
    // attaches them to the transaction correctly.
    const { agent, lib, queueName, sqs } = t.nr

    const createPrams = getCreateParams(queueName)
    const createCommand = new lib.CreateQueueCommand(createPrams)
    const { QueueUrl } = await sqs.send(createCommand)

    await helper.runInTransaction(agent, async (tx) => {
      const receiveMessageParams = getReceiveMessageParams(QueueUrl)
      const receiveMessageCommand = new lib.ReceiveMessageCommand(receiveMessageParams)
      await sqs.send(receiveMessageCommand)

      assert.equal(tx.acceptedDistributedTrace, true)
      assert.equal(tx.isDistributedTrace, true)
      // The traceId should propagate.
      const traceparent = tx.traceContext.createTraceparent()
      assert.equal(
        traceparent.startsWith('00-00015f9f95352ad550284c27c5d3084c'),
        true
      )
    })
  })

  await t.test('handles messages with MessageAttributes under DT correctly', async (t) => {
    // See issue https://github.com/newrelic/node-newrelic/issues/3901.
    const { http, lib, queueName, sqs } = t.nr

    const createPrams = getCreateParams(queueName)
    const createCommand = new lib.CreateQueueCommand(createPrams)
    const { QueueUrl } = await sqs.send(createCommand)

    const messageParams = getSendMessageParams(QueueUrl)
    messageParams.MessageAttributes = undefined
    const { server, address } = await awsEcho({
      http,
      awsClient: sqs,
      cmd: messageParams,
      CreateCommand: lib.SendMessageCommand
    })
    t.after(() => {
      server.close()
    })

    const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
    const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`
    const response = await helper.asyncHttpCall(address, {
      headers: { traceparent, tracestate }
    })
    const nrData = response.body.nrSendCommand
    assert.equal(
      nrData.MessageAttributes.traceparent.StringValue.startsWith(traceparent.slice(0, 35)),
      true
    )
    assert.deepEqual(nrData.MessageAttributes.tracestate, {
      DataType: 'String',
      StringValue: tracestate
    })
  })
})

function finish({ transaction, queueName }) {
  const expectedSegmentCount = 3

  const root = transaction.trace.root
  const segments = checkAWSAttributes({
    trace: transaction.trace,
    segment: root,
    pattern: SQS_PATTERN
  })

  assert.equal(
    segments.length,
    expectedSegmentCount,
    `should have ${expectedSegmentCount} AWS MessageBroker/SQS segments`
  )

  const externalSegments = checkAWSAttributes({
    trace: transaction.trace,
    segment: root,
    pattern: EXTERN_PATTERN
  })
  assert.equal(externalSegments.length, 0, 'should not have any External segments')

  const [sendMessage, sendMessageBatch, receiveMessage] = segments

  checkName(sendMessage.name, 'Produce', queueName)
  checkAttributes(sendMessage, 'SendMessageCommand')

  checkName(sendMessageBatch.name, 'Produce', queueName)
  checkAttributes(sendMessageBatch, 'SendMessageBatchCommand')

  checkName(receiveMessage.name, 'Consume', queueName)
  checkAttributes(receiveMessage, 'ReceiveMessageCommand')

  // Verify that cloud entity relationship attributes are present:
  for (const segment of segments) {
    const attrs = segment.getAttributes()
    assert.equal(attrs['messaging.system'], 'aws_sqs')
    assert.equal(attrs['cloud.region'], 'us-east-1')
    assert.equal(attrs['cloud.account.id'], '1234567890')
    assert.equal(attrs['messaging.destination.name'], queueName)
  }
}

function checkName(name, action, queueName) {
  const specificName = `/${action}/Named/${queueName}`

  match(name, specificName)
}

function checkAttributes(segment, operation) {
  const actualAttributes = segment.attributes.get(SEGMENT_DESTINATION)

  const expectedAttributes = {
    'aws.operation': operation,
    'aws.requestId': String,
    'aws.service': /sqs|SQS/,
    'aws.region': AWS_REGION
  }

  match(actualAttributes, expectedAttributes)
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
