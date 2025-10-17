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
const metrics = require('../../lib/metrics_helper')
const { assertPackageMetrics, assertMetrics, assertSegments } = require('./../../lib/custom-assertions')
const { version } = require('amqplib/package.json')

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

  await t.test('should log tracking metrics', function(t) {
    const { agent } = t.nr
    assertPackageMetrics({ agent, pkg: 'amqplib', version })
  })

  await t.test('connect in a transaction', async function (t) {
    const { agent, amqplib } = t.nr
    await helper.runInTransaction(agent, async function (tx) {
      const _conn = await amqplib.connect(amqpUtils.CON_STRING)
      const [segment] = tx.trace.getChildren(tx.trace.root.id)
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
      amqpUtils.verifyTransaction(agent, tx, 'assertExchange')
      const result = await channel.assertQueue('', { exclusive: true })
      amqpUtils.verifyTransaction(agent, tx, 'assertQueue')
      const queueName = result.queue
      await channel.bindQueue(queueName, amqpUtils.FANOUT_EXCHANGE)
      amqpUtils.verifyTransaction(agent, tx, 'bindQueue')
      channel.publish(amqpUtils.FANOUT_EXCHANGE, '', Buffer.from('hello'))
      tx.end()
      amqpUtils.verifyProduce(tx, amqpUtils.FANOUT_EXCHANGE)
    })
  })

  await t.test('publish to direct exchange', async function (t) {
    const { agent, channel } = t.nr
    await helper.runInTransaction(agent, async function (tx) {
      await channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct')
      amqpUtils.verifyTransaction(agent, tx, 'assertExchange')
      const result = await channel.assertQueue('', { exclusive: true })
      amqpUtils.verifyTransaction(agent, tx, 'assertQueue')
      const queueName = result.queue
      await channel.bindQueue(queueName, amqpUtils.DIRECT_EXCHANGE, 'key1')
      amqpUtils.verifyTransaction(agent, tx, 'bindQueue')
      channel.publish(amqpUtils.DIRECT_EXCHANGE, 'key1', Buffer.from('hello'))
      tx.end()
      amqpUtils.verifyProduce(tx, amqpUtils.DIRECT_EXCHANGE, 'key1')
    })
  })

  await t.test('publish to pre-declared exchange', async function (t) {
    const { agent, channel } = t.nr
    const fanoutExchange = 'amq.fanout'
    await helper.runInTransaction(agent, async function (tx) {
      await channel.assertExchange(fanoutExchange, 'fanout')
      const result = await channel.assertQueue('', { exclusive: true })
      const queueName = result.queue
      await channel.bindQueue(queueName, fanoutExchange, 'key1')
      channel.publish(fanoutExchange, 'key1', Buffer.from('hello'))
      tx.end()
      const segment = metrics.findSegment(
        tx.trace,
        tx.trace.root,
        'MessageBroker/RabbitMQ/Exchange/Produce/Temp'
      )
      assert.ok(segment, 'should create temp produce segment')
    })
  })

  await t.test('purge queue', async function (t) {
    const { agent, channel } = t.nr

    await helper.runInTransaction(agent, async function (tx) {
      await channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct')
      amqpUtils.verifyTransaction(agent, tx, 'assertExchange')
      const result = await channel.assertQueue('', { exclusive: true })
      amqpUtils.verifyTransaction(agent, tx, 'assertQueue')
      const queueName = result.queue
      await channel.bindQueue(queueName, amqpUtils.DIRECT_EXCHANGE, 'key1')
      amqpUtils.verifyTransaction(agent, tx, 'bindQueue')
      await channel.purgeQueue(queueName)
      amqpUtils.verifyTransaction(agent, tx, 'purgeQueue')
      tx.end()
      amqpUtils.verifyPurge(tx)
    })
  })

  await t.test('purge named queue', async function (t) {
    const { agent, channel } = t.nr

    await helper.runInTransaction(agent, async function (tx) {
      await channel.purgeQueue('testQueue')
      amqpUtils.verifyTransaction(agent, tx, 'purgeQueue')
      tx.end()
      const segments = [
        'MessageBroker/RabbitMQ/Queue/Purge/Named/testQueue'
      ]
      assertSegments(tx.trace, tx.trace.root, segments, 'should have expected segments')

      assertMetrics(tx.metrics, [[{ name: 'MessageBroker/RabbitMQ/Queue/Purge/Named/testQueue' }]], false, false)
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
    })
  })

  await t.test('should not capture segment parameters from get when there is no message to retrieve', async function (t) {
    const { agent, channel } = t.nr
    const queue = 'no-msg-queue'
    await helper.runInTransaction(agent, async function (tx) {
      await channel.assertQueue(queue, { durable: false })
      const msg = await channel.get(queue)
      assert.equal(msg, false)
      amqpUtils.verifyTransaction(agent, tx, 'get')
      const consumeName = `MessageBroker/RabbitMQ/Exchange/Consume/Named/${queue}`
      const segment = metrics.findSegment(tx.trace, tx.trace.root, consumeName)
      const attributes = segment.getAttributes()
      assert.deepEqual(attributes, {})
      tx.end()
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

      amqpUtils.verifyTransaction(agent, tx, 'get')
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
    await channel.consume(queue, function (msg) {
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
      amqpUtils.verifyTransaction(agent, tx, 'consume')
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
    agent.config.distributed_tracing.account_id = 1234
    agent.config.primary_application_id = 4321
    agent.config.trusted_account_key = 1234

    const exchange = amqpUtils.DIRECT_EXCHANGE
    await channel.assertExchange(exchange, 'direct')
    const { queue } = await channel.assertQueue('', { exclusive: true })
    await channel.bindQueue(queue, exchange, 'consume-tx-key')
    let publishTx
    let consumeTx
    // set up consume, this creates its own transaction
    await channel.consume(queue, function (msg) {
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
      amqpUtils.verifyTransaction(agent, tx, 'consume')
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
    await channel.consume(queue, function (msg) {
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
    await channel.consume(queue, function (msg) {
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

  await t.test('should create consume segment if consume is happening with an existing transaction', async function (t) {
    const { agent, api, channel } = t.nr
    const { promise, resolve } = promiseResolvers()
    const exchange = amqpUtils.DIRECT_EXCHANGE

    let publishTx
    let consumeTx
    const { queue } = await channel.assertQueue('', { exclusive: true })
    await channel.bindQueue(queue, amqpUtils.DIRECT_EXCHANGE, 'consume-tx-key')
    await helper.runInTransaction(agent, async function (tx) {
      publishTx = tx
      // set up consume, this creates its own transaction
      await channel.consume(queue, function (msg) {
        const consumeTxnHandle = api.getTransaction()
        consumeTx = consumeTxnHandle._transaction
        assert.ok(msg, 'should receive a message')

        const body = msg.content.toString('utf8')
        assert.equal(body, 'hello', 'should receive expected body')

        channel.ack(msg)
        publishTx.end()
        consumeTx.end()
        resolve()
      }, { noAck: true })
      amqpUtils.verifyTransaction(agent, tx, 'consume')
      channel.publish(exchange, 'consume-tx-key', Buffer.from('hello'))
    })
    await promise
    assert.notStrictEqual(consumeTx, publishTx, 'should not be in original transaction')
    const segments = ['amqplib.Channel#consume', 'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange]
    amqpUtils.verifySubscribe(publishTx, exchange, 'consume-tx-key', segments)
    amqpUtils.verifyConsumeTransaction(consumeTx, exchange, queue, 'consume-tx-key')
  })

  await t.test('publish to pre-declared exchange', async function (t) {
    const { api, channel } = t.nr
    const { promise, resolve } = promiseResolvers()
    const fanoutExchange = 'amq.fanout'
    await channel.assertExchange(fanoutExchange, 'fanout')
    const { queue } = await channel.assertQueue('', { exclusive: true })
    let tx
    await channel.consume(queue, function (msg) {
      ;({ _transaction: tx } = api.getTransaction())
      assert.ok(msg, 'should receive a message')

      const body = msg.content.toString('utf8')
      assert.equal(body, 'hello', 'should receive expected body')

      channel.ack(msg)
      tx.end()
      resolve()
    })
    await channel.bindQueue(queue, fanoutExchange, 'key1')
    channel.publish(fanoutExchange, 'key1', Buffer.from('hello'))

    await promise
    assert.equal(
      tx.getFullName(),
      'OtherTransaction/Message/RabbitMQ/Exchange/Temp',
      'should not set transaction name'
    )
  })

  await t.test('should connect with object', async function (t) {
    const { agent, amqplib } = t.nr
    await helper.runInTransaction(agent, async function (tx) {
      const _conn = await amqplib.connect(amqpUtils.CON_OBJECT)
      const [segment] = tx.trace.getChildren(tx.trace.root.id)
      assert.equal(segment.name, 'amqplib.connect')
      const attrs = segment.getAttributes()
      assert.equal(attrs.host, 'localhost')
      assert.equal(attrs.port_path_or_id, 5672)
      await _conn.close()
    })
  })

  await t.test('should connect with object and default port if not specified', async function (t) {
    const { agent, amqplib } = t.nr
    await helper.runInTransaction(agent, async function (tx) {
      const connectObject = { ...amqpUtils.CON_OBJECT }
      delete connectObject.port
      const _conn = await amqplib.connect(connectObject)
      const [segment] = tx.trace.getChildren(tx.trace.root.id)
      assert.equal(segment.name, 'amqplib.connect')
      const attrs = segment.getAttributes()
      assert.equal(attrs.host, 'localhost')
      assert.equal(attrs.port_path_or_id, 5672)
      await _conn.close()
    })
  })

  await t.test('should connect with object and default port to 5671 if protocol/port is not specified', async function (t) {
    const { agent, amqplib } = t.nr
    await helper.runInTransaction(agent, async function (tx) {
      const connectObject = { ...amqpUtils.CON_OBJECT }
      delete connectObject.port
      delete connectObject.protocol
      const _conn = await amqplib.connect(connectObject)
      const [segment] = tx.trace.getChildren(tx.trace.root.id)
      assert.equal(segment.name, 'amqplib.connect')
      const attrs = segment.getAttributes()
      assert.equal(attrs.host, 'localhost')
      assert.equal(attrs.port_path_or_id, 5671)
      await _conn.close()
    })
  })

  await t.test('should not assign port/host if string is malformed URL', async function (t) {
    const { agent, amqplib } = t.nr
    await helper.runInTransaction(agent, async function (tx) {
      assert.rejects(async () => {
        await amqplib.connect('invalidhost')
      })
      const [segment] = tx.trace.getChildren(tx.trace.root.id)
      assert.equal(segment.name, 'amqplib.connect')
      const attrs = segment.getAttributes()
      assert.deepEqual(attrs, {})
    })
  })
})
