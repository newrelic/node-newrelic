/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import helper from '../../lib/agent_helper.js'
import promiseResolvers from '../../lib/promise-resolvers.js'

const agent = helper.instrumentMockedAgent({
  attributes: {
    enabled: true
  }
})
const params = {
  encoding_key: 'this is an encoding key',
  cross_process_id: '1234#4321'
}
agent.config._fromServer(params, 'encoding_key')
agent.config._fromServer(params, 'cross_process_id')
agent.config.trusted_account_ids = [1234]

import amqpUtils from '../amqplib/amqp-utils.js'
import amqplib from 'amqplib'

test('esm import does instrumentation', async () => {
  const { promise, resolve } = promiseResolvers()
  const { connection: conn, channel } = await amqpUtils.getChannel(amqplib)
  await channel.assertQueue('testQueue')

  test.after(async () => {
    helper.unloadAgent(agent)
    await conn.close()
  })

  const exchange = amqpUtils.DIRECT_EXCHANGE

  await channel.assertExchange(exchange, 'direct')
  const { queue } = await channel.assertQueue('', { exclusive: true })
  await channel.bindQueue(queue, exchange, 'consume-tx-key')
  await helper.runInTransaction(agent, async function (tx) {
    channel.publish(exchange, 'consume-tx-key', Buffer.from('hello'))
    const msg = await channel.get(queue)
    assert.ok(msg, 'should receive a message')
    const body = msg.content.toString('utf8')
    assert.equal(body, 'hello', 'should receive expected body')

    amqpUtils.verifyTransaction(agent, tx, 'get')
    channel.ack(msg)
    tx.end()
    amqpUtils.verifyGet({
      tx,
      exchangeName: exchange,
      routingKey: 'consume-tx-key',
      queue,
      assertAttr: true
    })
    resolve()
  })

  await promise
})
