/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const sinon = require('sinon')
const { tspl } = require('@matteo.collina/tspl')
const { match } = require('../../lib/custom-assertions')

test('SNS', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const Shim = require('../../../lib/shim/message-shim')
    ctx.nr.setLibrarySpy = sinon.spy(Shim.prototype, 'setLibrary')
    const lib = require('@aws-sdk/client-sns')
    const SNSClient = lib.SNSClient
    ctx.nr.lib = lib
    ctx.nr.sns = new SNSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: 'us-east-1'
    })
  })

  t.afterEach((ctx) => {
    common.afterEach(ctx)
    ctx.nr.setLibrarySpy.restore()
  })

  await t.test('publish with callback', (t, end) => {
    const {
      agent,
      sns,
      setLibrarySpy,
      lib: { PublishCommand }
    } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const params = { Message: 'Hello!' }

      const cmd = new PublishCommand(params)
      sns.send(cmd, (err) => {
        assert.ok(!err)
        tx.end()

        const destName = 'PhoneNumber'
        const args = [end, tx, destName, setLibrarySpy]
        setImmediate(finish, ...args)
      })
    })
  })

  await t.test('publish with default destination(PhoneNumber)', (t, end) => {
    const {
      agent,
      sns,
      setLibrarySpy,
      lib: { PublishCommand }
    } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const params = { Message: 'Hello!' }

      const cmd = new PublishCommand(params)
      await sns.send(cmd)

      tx.end()

      const destName = 'PhoneNumber'
      const args = [end, tx, destName, setLibrarySpy]
      setImmediate(finish, ...args)
    })
  })

  await t.test('publish with TopicArn as destination', (t, end) => {
    const {
      agent,
      sns,
      setLibrarySpy,
      lib: { PublishCommand }
    } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const TopicArn = 'TopicArn'
      const params = { TopicArn, Message: 'Hello!' }

      const cmd = new PublishCommand(params)
      await sns.send(cmd)

      tx.end()

      const args = [end, tx, TopicArn, setLibrarySpy]
      setImmediate(finish, ...args)
    })
  })

  await t.test('publish with TargetArn as destination', (t, end) => {
    const {
      agent,
      sns,
      setLibrarySpy,
      lib: { PublishCommand }
    } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const TargetArn = 'TargetArn'
      const params = { TargetArn, Message: 'Hello!' }

      const cmd = new PublishCommand(params)
      await sns.send(cmd)

      tx.end()

      const args = [end, tx, TargetArn, setLibrarySpy]
      setImmediate(finish, ...args)
    })
  })

  await t.test(
    'publish with TopicArn as destination when both Topic and Target Arn are defined',
    (t, end) => {
      const {
        agent,
        sns,
        setLibrarySpy,
        lib: { PublishCommand }
      } = t.nr
      helper.runInTransaction(agent, async (tx) => {
        const TargetArn = 'TargetArn'
        const TopicArn = 'TopicArn'
        const params = { TargetArn, TopicArn, Message: 'Hello!' }

        const cmd = new PublishCommand(params)
        await sns.send(cmd)
        tx.end()

        const args = [end, tx, TopicArn, setLibrarySpy]
        setImmediate(finish, ...args)
      })
    }
  )

  await t.test(
    'should record external segment and not a SNS segment for a command that is not PublishCommand',
    (t, end) => {
      const {
        agent,
        sns,
        lib: { ListTopicsCommand }
      } = t.nr
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
    const {
      agent,
      sns,
      lib: { ListTopicsCommand }
    } = t.nr
    const plan = tspl(t, { plan: 2 })

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
})

function finish(end, tx, destName, setLibrarySpy) {
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
  }),
    assert.equal(setLibrarySpy.callCount, 1, 'should only call setLibrary once and not per call')
  end()
}
