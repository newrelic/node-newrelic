/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const amqpUtils = require('./amqp-utils')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
const promiseResolvers = require('../../lib/promise-resolvers')

/*
TODO:

- promise API
- callback API

consumer
- off by default for rum
- value of the attribute is limited to 255 bytes

 */

test('amqplib promise instrumentation', async function (t) {
  t.beforeEach(async function (ctx) {
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

    const api = new API(agent)

    const amqplib = require('amqplib')

    const { connection: conn, channel } = await amqpUtils.getChannel(amqplib)
    ctx.nr = {
      agent,
      amqplib,
      api,
      channel,
      conn
    }
    await channel.assertQueue('testQueue')
  })

  t.afterEach(async function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
    removeMatchedModules(/amqplib/)
    await ctx.nr.conn.close()
  })

  await t.test('connect in a transaction', async function (t) {
    const { agent, amqplib } = t.nr
    await helper.runInTransaction(agent, async function (tx) {
      const _conn = await amqplib.connect(amqpUtils.CON_STRING)
      const [segment] = tx.trace.root.children
      assert.equal(segment.name, 'amqplib.connect')
      const attrs = segment.getAttributes()
      assert.equal(attrs.host, 'localhost')
      assert.equal(attrs.port_path_or_id, 5672)
      await _conn.close()
    })
  })

  await t.test('sendToQueue', async function (t) {
    const { agent, channel } = t.nr
    const { promise, resolve } = promiseResolvers()

    helper.runInTransaction(agent, function transactionInScope(tx) {
      channel.sendToQueue('testQueue', Buffer.from('hello'), {
        replyTo: 'my.reply.queue',
        correlationId: 'correlation-id'
      })
      tx.end()
      amqpUtils.verifySendToQueue(tx)
      resolve()
    })
    await promise
  })

  await t.test('publish to fanout exchange', async function (t) {
    const { agent, channel } = t.nr
    await helper.runInTransaction(agent, async function (tx) {
      assert.ok(agent.tracer.getSegment(), 'should start in transaction')
      await channel.assertExchange(amqpUtils.FANOUT_EXCHANGE, 'fanout')
      amqpUtils.verifyTransaction(tx, 'assertExchange')
      const result = await channel.assertQueue('', { exclusive: true })
      amqpUtils.verifyTransaction(tx, 'assertQueue')
      const queueName = result.queue
      await channel.bindQueue(queueName, amqpUtils.FANOUT_EXCHANGE)
      amqpUtils.verifyTransaction(tx, 'bindQueue')
      channel.publish(amqpUtils.FANOUT_EXCHANGE, '', Buffer.from('hello'))
      tx.end()
      amqpUtils.verifyProduce(tx, amqpUtils.FANOUT_EXCHANGE)
    })
  })

  await t.test('publish to direct exchange', async function (t) {
    const { agent, channel } = t.nr
    await helper.runInTransaction(agent, async function (tx) {
      await channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct')
      amqpUtils.verifyTransaction(tx, 'assertExchange')
      const result = await channel.assertQueue('', { exclusive: true })
      amqpUtils.verifyTransaction(tx, 'assertQueue')
      const queueName = result.queue
      await channel.bindQueue(queueName, amqpUtils.DIRECT_EXCHANGE, 'key1')
      amqpUtils.verifyTransaction(tx, 'bindQueue')
      channel.publish(amqpUtils.DIRECT_EXCHANGE, 'key1', Buffer.from('hello'))
      tx.end()
      amqpUtils.verifyProduce(tx, amqpUtils.DIRECT_EXCHANGE, 'key1')
    })
  })

  await t.test('purge queue', async function (t) {
    const { agent, channel } = t.nr

    await helper.runInTransaction(agent, async function (tx) {
      await channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct')
      amqpUtils.verifyTransaction(tx, 'assertExchange')
      const result = await channel.assertQueue('', { exclusive: true })
      amqpUtils.verifyTransaction(tx, 'assertQueue')
      const queueName = result.queue
      await channel.bindQueue(queueName, amqpUtils.DIRECT_EXCHANGE, 'key1')
      amqpUtils.verifyTransaction(tx, 'bindQueue')
      await channel.purgeQueue(queueName)
      amqpUtils.verifyTransaction(tx, 'purgeQueue')
      tx.end()
      amqpUtils.verifyPurge(tx)
    })
  })

  await t.test('get a message', async function (t) {
    const { agent, channel } = t.nr
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

      amqpUtils.verifyTransaction(tx, 'get')
      channel.ack(msg)
      tx.end()
      amqpUtils.verifyGet({
        tx,
        exchangeName: exchange,
        routingKey: 'consume-tx-key',
        queue,
        assertAttr: true
      })
    })
  })

  await t.test('get a message disable parameters', async function (t) {
    const { agent, channel } = t.nr
    agent.config.message_tracer.segment_parameters.enabled = false
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

      amqpUtils.verifyTransaction(tx, 'get')
      channel.ack(msg)
      tx.end()
      amqpUtils.verifyGet({
        tx,
        exchangeName: exchange,
        queue
      })
    })
  })

  await t.test('consume in a transaction with old CAT', async function (t) {
    const { agent, api, channel } = t.nr
    const { promise, resolve } = promiseResolvers()
    agent.config.cross_application_tracer.enabled = true
    agent.config.distributed_tracing.enabled = false
    const exchange = amqpUtils.DIRECT_EXCHANGE

    await channel.assertExchange(exchange, 'direct')
    const { queue } = await channel.assertQueue('', { exclusive: true })
    await channel.bindQueue(queue, exchange, 'consume-tx-key')
    let publishTx
    let consumeTx
    // set up consume, this creates its own transaction
    channel.consume(queue, function (msg) {
      const consumeTxnHandle = api.getTransaction()
      consumeTx = consumeTxnHandle._transaction
      assert.ok(msg, 'should receive a message')

      const body = msg.content.toString('utf8')
      assert.equal(body, 'hello', 'should receive expected body')

      channel.ack(msg)
      publishTx.end()
      consumeTx.end()
      resolve()
    })
    await helper.runInTransaction(agent, async function (tx) {
      publishTx = tx
      amqpUtils.verifyTransaction(tx, 'consume')
      channel.publish(exchange, 'consume-tx-key', Buffer.from('hello'))
    })
    await promise
    assert.notStrictEqual(consumeTx, publishTx, 'should not be in original transaction')
    amqpUtils.verifySubscribe(publishTx, exchange, 'consume-tx-key')
    amqpUtils.verifyConsumeTransaction(consumeTx, exchange, queue, 'consume-tx-key')
    amqpUtils.verifyCAT(publishTx, consumeTx)
  })

  await t.test('consume in a transaction with distributed tracing', async function (t) {
    const { agent, api, channel } = t.nr
    const { promise, resolve } = promiseResolvers()
    agent.config.account_id = 1234
    agent.config.primary_application_id = 4321
    agent.config.trusted_account_key = 1234

    const exchange = amqpUtils.DIRECT_EXCHANGE
    await channel.assertExchange(exchange, 'direct')
    const { queue } = await channel.assertQueue('', { exclusive: true })
    await channel.bindQueue(queue, exchange, 'consume-tx-key')
    let publishTx
    let consumeTx
    // set up consume, this creates its own transaction
    channel.consume(queue, function (msg) {
      const consumeTxnHandle = api.getTransaction()
      consumeTx = consumeTxnHandle._transaction
      assert.ok(msg, 'should receive a message')

      const body = msg.content.toString('utf8')
      assert.equal(body, 'hello', 'should receive expected body')

      channel.ack(msg)
      publishTx.end()
      consumeTx.end()
      resolve()
    })
    await helper.runInTransaction(agent, async function (tx) {
      publishTx = tx
      amqpUtils.verifyTransaction(tx, 'consume')
      channel.publish(exchange, 'consume-tx-key', Buffer.from('hello'))
    })
    await promise
    assert.notStrictEqual(consumeTx, publishTx, 'should not be in original transaction')
    amqpUtils.verifySubscribe(publishTx, exchange, 'consume-tx-key')
    amqpUtils.verifyConsumeTransaction(consumeTx, exchange, queue, 'consume-tx-key')
    amqpUtils.verifyDistributedTrace(publishTx, consumeTx)
  })

  await t.test('consume out of transaction', async function (t) {
    const { api, channel } = t.nr
    const { promise, resolve } = promiseResolvers()

    await channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct')
    const { queue } = await channel.assertQueue('', { exclusive: true })
    await channel.bindQueue(queue, amqpUtils.DIRECT_EXCHANGE, 'consume-tx-key')
    let tx
    channel.consume(queue, function (msg) {
      ;({ _transaction: tx } = api.getTransaction())
      assert.ok(msg, 'should receive a message')

      const body = msg.content.toString('utf8')
      assert.equal(body, 'hello', 'should receive expected body')

      channel.ack(msg)
      tx.end()
      resolve()
    })
    channel.publish(amqpUtils.DIRECT_EXCHANGE, 'consume-tx-key', Buffer.from('hello'))
    await promise
    amqpUtils.verifyConsumeTransaction(tx, amqpUtils.DIRECT_EXCHANGE, queue, 'consume-tx-key')
  })

  await t.test('rename message consume transaction', async function (t) {
    const { api, channel } = t.nr
    const { promise, resolve } = promiseResolvers()

    await channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct')
    const { queue } = await channel.assertQueue('', { exclusive: true })
    await channel.bindQueue(queue, amqpUtils.DIRECT_EXCHANGE, 'consume-tx-key')
    let tx
    channel.consume(queue, function (msg) {
      api.setTransactionName('foobar')

      channel.ack(msg)
      ;({ _transaction: tx } = api.getTransaction())
      tx.end()
      resolve()
    })
    channel.publish(amqpUtils.DIRECT_EXCHANGE, 'consume-tx-key', Buffer.from('hello'))
    await promise
    assert.equal(
      tx.getFullName(),
      'OtherTransaction/Message/Custom/foobar',
      'should have specified name'
    )
  })
})
