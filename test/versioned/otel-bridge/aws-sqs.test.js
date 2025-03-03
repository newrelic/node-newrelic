/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const otel = require('@opentelemetry/api')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const sinon = require('sinon')
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
    ctx.nr.agent = helper.instrumentMockedAgent({
      feature_flag: {
        opentelemetry_bridge: true
      },
      instrumentation: {
        // TODO: is this the correct way to disable the instrumentation?
        '@aws-sdk/client-sqs': {
          enabled: false
        }
      }
    })
    ctx.nr.api = helper.getAgentApi()
    ctx.nr.tracer = otel.trace.getTracer('sqs-client-test')
    const Shim = require('../../../lib/shim/message-shim')
    ctx.nr.setLibrarySpy = sinon.spy(Shim.prototype, 'setLibrary')
    const lib = require('@aws-sdk/client-sqs')
    const SQSClient = lib.SQSClient
    ctx.nr.lib = lib

    ctx.nr.sqs = new SQSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://sqs.${AWS_REGION}.amazonaws.com:${server.address().port}`,
      region: AWS_REGION
    })

    ctx.nr.queueName = 'delete-aws-sdk-test-queue-' + Math.floor(Math.random() * 100000)
  })

  t.afterEach((ctx) => {
    common.afterEach(ctx)
    ctx.nr.setLibrarySpy.restore()
  })

  await t.test('commands with promises', async (t) => {
    const {
      agent,
      queueName,
      sqs,
      setLibrarySpy,
      tracer,
      lib: {
        CreateQueueCommand,
        SendMessageCommand,
        SendMessageBatchCommand,
        ReceiveMessageCommand
      }
    } = t.nr
    agent.config.cloud.aws.account_id = 1234567890
    // create queue
    const createParams = getCreateParams(queueName)
    const createCommand = new CreateQueueCommand(createParams)
    const { QueueUrl } = await sqs.send(createCommand)
    assert.ok(QueueUrl)

    // Expected otel attributes from spec
    // https://github.com/open-telemetry/opentelemetry-specification/blob/v1.7.0/specification/trace/semantic_conventions/messaging.md#messaging-attributes
    const attributes = {
      'cloud.region': AWS_REGION,
      'messaging.system': 'AmazonSQS',
      'messaging.message_id': String,
      'messaging.url': QueueUrl,
      'messaging.destination': queueName,
    }

    // run send/receive commands in transaction
    await helper.runInTransaction(agent, async (transaction) => {
      transaction.name = 'sqs-commands'
      tracer.startActiveSpan(transaction.name, { kind: otel.SpanKind.CLIENT, attributes }, async (span) => {
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
        span.end()
        await finish({ transaction, queueName, setLibrarySpy })
      })
    })
  })
})

function finish({ transaction, queueName, setLibrarySpy }) {
  const expectedSegmentCount = 3

  const root = transaction.trace.root
  const segments = common.checkAWSAttributes({
    trace: transaction.trace,
    segment: root,
    pattern: common.SQS_PATTERN
  })

  assert.equal(
    segments.length,
    expectedSegmentCount,
        `should have ${expectedSegmentCount} AWS MessageBroker/SQS segments`
  )

  const externalSegments = common.checkAWSAttributes({
    trace: transaction.trace,
    segment: root,
    pattern: common.EXTERN_PATTERN
  })
  assert.equal(externalSegments.length, 0, 'should not have any External segments')

  const [sendMessage, sendMessageBatch, receiveMessage] = segments

  checkName(sendMessage.name, 'Produce', queueName)
  checkAttributes(sendMessage, 'SendMessageCommand')

  checkName(sendMessageBatch.name, 'Produce', queueName)
  checkAttributes(sendMessageBatch, 'SendMessageBatchCommand')

  checkName(receiveMessage.name, 'Consume', queueName)
  checkAttributes(receiveMessage, 'ReceiveMessageCommand')
  assert.equal(setLibrarySpy.callCount, 1, 'should only call setLibrary once and not per call')

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
  const actualAttributes = segment.attributes.get(common.SEGMENT_DESTINATION)

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
