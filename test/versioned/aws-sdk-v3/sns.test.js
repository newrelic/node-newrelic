/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const awsEcho = require('./test-utils/aws-echo.js')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { tspl } = require('@matteo.collina/tspl')
const { match } = require('../../lib/custom-assertions')

test('SNS', async (t) => {
  const server = createResponseServer()

  await new Promise((resolve) => {
    server.listen(0, resolve)
  })

  const agent = helper.instrumentMockedAgent()
  const http = require('node:http')
  const lib = require('@aws-sdk/client-sns')
  const SNSClient = lib.SNSClient
  const sns = new SNSClient({
    credentials: FAKE_CREDENTIALS,
    endpoint: `http://localhost:${server.address().port}`,
    region: 'us-east-1'
  })

  t.after(() => {
    server.destroy()
    helper.unloadAgent(agent)
  })

  await t.test('publish with callback', (t, end) => {
    const { PublishCommand } = lib
    helper.runInTransaction(agent, (tx) => {
      const params = { Message: 'Hello!' }

      const cmd = new PublishCommand(params)
      sns.send(cmd, (err) => {
        assert.ok(!err)
        tx.end()

        const destName = 'PhoneNumber'
        const args = [end, tx, destName]
        setImmediate(finish, ...args)
      })
    })
  })

  await t.test('publish with default destination(PhoneNumber)', (t, end) => {
    const { PublishCommand } = lib
    helper.runInTransaction(agent, async (tx) => {
      const params = { Message: 'Hello!' }

      const cmd = new PublishCommand(params)
      await sns.send(cmd)

      tx.end()

      const destName = 'PhoneNumber'
      const args = [end, tx, destName]
      setImmediate(finish, ...args)
    })
  })

  await t.test('publish with TopicArn as destination', (t, end) => {
    const { PublishCommand } = lib
    helper.runInTransaction(agent, async (tx) => {
      const TopicArn = 'TopicArn'
      const params = { TopicArn, Message: 'Hello!' }

      const cmd = new PublishCommand(params)
      await sns.send(cmd)

      tx.end()

      const args = [end, tx, TopicArn]
      setImmediate(finish, ...args)
    })
  })

  await t.test('publish with TargetArn as destination', (t, end) => {
    const { PublishCommand } = lib
    helper.runInTransaction(agent, async (tx) => {
      const TargetArn = 'TargetArn'
      const params = { TargetArn, Message: 'Hello!' }

      const cmd = new PublishCommand(params)
      await sns.send(cmd)

      tx.end()

      const args = [end, tx, TargetArn]
      setImmediate(finish, ...args)
    })
  })

  await t.test(
    'publish with TopicArn as destination when both Topic and Target Arn are defined',
    (t, end) => {
      const { PublishCommand } = lib
      helper.runInTransaction(agent, async (tx) => {
        const TargetArn = 'TargetArn'
        const TopicArn = 'TopicArn'
        const params = { TargetArn, TopicArn, Message: 'Hello!' }

        const cmd = new PublishCommand(params)
        await sns.send(cmd)
        tx.end()

        const args = [end, tx, TopicArn]
        setImmediate(finish, ...args)
      })
    }
  )

  await t.test(
    'should record external segment and not a SNS segment for a command that is not PublishCommand',
    (t, end) => {
      const { ListTopicsCommand } = lib
      helper.runInTransaction(agent, async (tx) => {
        const TargetArn = 'TargetArn'
        const TopicArn = 'TopicArn'
        const params = { TargetArn, TopicArn, Message: 'Hello!' }

        const cmd = new ListTopicsCommand(params)
        await sns.send(cmd)
        tx.end()

        setImmediate(common.checkExternals, {
          end,
          tx,
          service: 'SNS',
          operations: ['ListTopicsCommand']
        })
      })
    }
  )

  await t.test('should mark requests to be dt-disabled', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { ListTopicsCommand } = lib

    await helper.runInTransaction(agent, async (tx) => {
      const params = { Message: 'Hiya' }
      const cmd = new ListTopicsCommand(params)
      sns.middlewareStack.add(
        (next) => async (args) => {
          const result = await next(args)
          const headers = result.response.body.req.getHeaders()
          plan.ok(!headers.traceparent, 'should not add traceparent header to request')
          return result
        },
        { name: 'TestMw', step: 'deserialize' }
      )
      const res = await sns.send(cmd)
      tx.end()
      plan.ok(res)
    })
  })

  await t.test('attaches distributed trace headers when sending messages', async (t) => {
    const params = { TargetArn: 'TargetArn', Message: 'Hello!' }
    const { server, address } = await awsEcho({
      http,
      awsClient: sns,
      cmd: params,
      CreateCommand: lib.PublishCommand
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
    // This is a race condition waiting to happen.
    agent.config.distributed_tracing.enabled = false

    const params = { TargetArn: 'TargetArn', Message: 'Hello!' }
    const { server, address } = await awsEcho({
      http,
      awsClient: sns,
      cmd: params,
      CreateCommand: lib.PublishCommand
    })
    t.after(() => {
      agent.config.distributed_tracing.enabled = true
      server.close()
    })

    const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
    const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`
    const response = await helper.asyncHttpCall(address, {
      headers: { traceparent, tracestate }
    })
    const nrData = response.body.nrSendCommand
    assert.equal(nrData.MessageAttributes.traceparent, undefined)
    assert.deepEqual(nrData.MessageAttributes.tracestate, undefined)
  })
})

function finish(end, tx, destName) {
  const root = tx.trace.root

  const messages = common.checkAWSAttributes({
    trace: tx.trace,
    segment: root,
    pattern: common.SNS_PATTERN
  })
  assert.equal(messages.length, 1, 'should have 1 message broker segment')
  assert.ok(messages[0].name.endsWith(destName), 'should have appropriate destination')

  const externalSegments = common.checkAWSAttributes({
    trace: tx.trace,
    segment: root,
    pattern: common.EXTERN_PATTERN
  })
  assert.equal(externalSegments.length, 0, 'should not have any External segments')

  const attrs = messages[0].attributes.get(common.SEGMENT_DESTINATION)
  match(attrs, {
    'aws.operation': 'PublishCommand',
    'aws.requestId': String,
    'aws.service': /sns|SNS/,
    'aws.region': 'us-east-1'
  })
  end()
}
