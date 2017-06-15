'use strict'

var amqpUtils = require('./amqp-utils')
var API = require('../../../api')
var helper = require('../../lib/agent_helper')
var tap = require('tap')


/*
TODO:

- promise API
- callback API

consumer
- off by default for rum
- value of the attribute is limited to 255 bytes

 */

tap.test('amqplib callback instrumentation', function(t) {
  t.autoend()

  var amqplib = null
  var conn = null
  var channel = null
  var agent = null
  var api = null

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    agent.config.capture_params = true

    api = new API(agent)

    var instrumentation = require('../../../lib/instrumentation/amqplib')
    api.instrumentMessages('amqplib/callback_api', instrumentation.instrumentCallbackAPI)

    amqplib = require('amqplib/callback_api')
    amqpUtils.getChannel(amqplib, function(err, result) {
      if (err) {
        return done(err)
      }

      conn = result.connection
      channel = result.channel
      channel.assertQueue('testQueue', null, done)
    })
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)

    if (!conn) {
      return done()
    }

    conn.close(done)
  })

  t.test('sendToQueue', function(t) {
    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifySendToQueue(t, tx)
      t.end()
    })

    helper.runInTransaction(agent, function transactionInScope(tx) {
      channel.sendToQueue('testQueue', new Buffer('hello'), {
        replyTo: 'my.reply.queue',
        correlationId: 'correlation-id'
      })
      tx.end()
    })
  })

  t.test('publish to fanout exchange', function(t) {
    var exchange = amqpUtils.FANOUT_EXCHANGE

    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifyPublish(t, tx, exchange)
      t.end()
    })

    helper.runInTransaction(agent, function(tx) {
      t.ok(agent.tracer.getSegment(), 'should start in transaction')
      channel.assertExchange(exchange, 'fanout', null, function(err) {
        t.error(err, 'should not error asserting exchange')
        amqpUtils.verifyTransaction(t, tx, 'assertExchange')

        channel.assertQueue('', {exclusive: true}, function(err, result) {
          t.error(err, 'should not error asserting queue')
          amqpUtils.verifyTransaction(t, tx, 'assertQueue')
          var queueName = result.queue

          channel.bindQueue(queueName, exchange, '', null, function(err) {
            t.error(err, 'should not error binding queue')
            amqpUtils.verifyTransaction(t, tx, 'bindQueue')
            channel.publish(exchange, '', new Buffer('hello'))
            setImmediate(function() { tx.end() })
          })
        })
      })
    })
  })

  t.test('publish to direct exchange', function(t) {
    var exchange = amqpUtils.DIRECT_EXCHANGE

    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifyPublish(t, tx, exchange, 'key1')
      t.end()
    })

    helper.runInTransaction(agent, function(tx) {
      channel.assertExchange(exchange, 'direct', null, function(err) {
        t.error(err, 'should not error asserting exchange')
        amqpUtils.verifyTransaction(t, tx, 'assertExchange')

        channel.assertQueue('', {exclusive: true}, function(err, result) {
          t.error(err, 'should not error asserting queue')
          amqpUtils.verifyTransaction(t, tx, 'assertQueue')
          var queueName = result.queue

          channel.bindQueue(queueName, exchange, 'key1', null, function(err) {
            t.error(err, 'should not error binding queue')
            amqpUtils.verifyTransaction(t, tx, 'bindQueue')
            channel.publish(exchange, 'key1', new Buffer('hello'))
            setImmediate(function() { tx.end() })
          })
        })
      })
    })
  })

  t.test('purge queue', function(t) {
    var exchange = amqpUtils.DIRECT_EXCHANGE
    var queueName = null

    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifyPurge(t, tx)
      t.end()
    })

    helper.runInTransaction(agent, function(tx) {
      channel.assertExchange(exchange, 'direct', null, function(err) {
        t.error(err, 'should not error asserting exchange')
        amqpUtils.verifyTransaction(t, tx, 'assertExchange')

        channel.assertQueue('', {exclusive: true}, function(err, result) {
          t.error(err, 'should not error asserting queue')
          amqpUtils.verifyTransaction(t, tx, 'assertQueue')
          queueName = result.queue

          channel.bindQueue(queueName, exchange, 'key1', null, function(err) {
            t.error(err, 'should not error binding queue')
            amqpUtils.verifyTransaction(t, tx, 'bindQueue')
            channel.purgeQueue(queueName, function(err) {
              t.error(err, 'should not error purging queue')
              setImmediate(function() { tx.end() })
            })
          })
        })
      })
    })
  })

  t.test('consume in a transaction', function(t) {
    var exchange = amqpUtils.DIRECT_EXCHANGE
    var queue = null

    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifyConsume(t, tx, exchange, 'consume-tx-key')
      t.end()
    })

    channel.assertExchange(exchange, 'direct', null, function(err) {
      t.error(err, 'should not error asserting exchange')

      channel.assertQueue('', {exclusive: true}, function(err, res) {
        t.error(err, 'should not error asserting queue')
        queue = res.queue

        channel.bindQueue(queue, exchange, 'consume-tx-key', null, function(err) {
          t.error(err, 'should not error binding queue')

          helper.runInTransaction(agent, function(tx) {
            channel.consume(queue, function(msg) {
              amqpUtils.verifyTransaction(t, tx, 'message consumer')
              t.ok(msg, 'should receive a message')

              var body = msg.content.toString('utf8')
              t.equal(body, 'hello', 'should receive expected body')

              channel.ack(msg)
              setImmediate(function() { tx.end() })
            }, null, function(err) {
              t.error(err, 'should not error subscribing consumer')
              amqpUtils.verifyTransaction(t, tx, 'consume')

              channel.publish(
                amqpUtils.DIRECT_EXCHANGE,
                'consume-tx-key',
                new Buffer('hello')
              )
            })
          })
        })
      })
    })
  })

  t.test('consume out of transaction', function(t) {
    var exchange = amqpUtils.DIRECT_EXCHANGE
    var queue = null

    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifyConsumeTransaction(t, tx, exchange, 'consume-tx-key')
      t.end()
    })

    channel.assertExchange(exchange, 'direct', null, function(err) {
      t.error(err, 'should not error asserting exchange')

      channel.assertQueue('', {exclusive: true}, function(err, res) {
        t.error(err, 'should not error asserting queue')
        queue = res.queue

        channel.bindQueue(queue, exchange, 'consume-tx-key', null, function(err) {
          t.error(err, 'should not error binding queue')

          channel.consume(queue, function(msg) {
            var tx = api.getTransaction()
            t.ok(msg, 'should receive a message')

            var body = msg.content.toString('utf8')
            t.equal(body, 'hello', 'should receive expected body')

            channel.ack(msg)

            setImmediate(function() { tx.end() })
          }, null, function(err) {
            t.error(err, 'should not error subscribing consumer')

            channel.publish(
              amqpUtils.DIRECT_EXCHANGE,
              'consume-tx-key',
              new Buffer('hello')
            )
          })
        })
      })
    })
  })

  t.test('rename message consume transaction', function(t) {
    var exchange = amqpUtils.DIRECT_EXCHANGE
    var queue = null

    agent.on('transactionFinished', function(tx) {
      t.equal(tx.getFullName(), 'Custom/foobar', 'should have specified name')
      t.end()
    })

    channel.assertExchange(exchange, 'direct', null, function(err) {
      t.error(err, 'should not error asserting exchange')

      channel.assertQueue('', {exclusive: true}, function(err, res) {
        t.error(err, 'should not error asserting queue')
        queue = res.queue

        channel.bindQueue(queue, exchange, 'consume-tx-key', null, function(err) {
          t.error(err, 'should not error binding queue')

          channel.consume(queue, function(msg) {
            var tx = api.getTransaction()
            api.setTransactionName('foobar')

            channel.ack(msg)

            setImmediate(function() { tx.end() })
          }, null, function(err) {
            t.error(err, 'should not error subscribing consumer')

            channel.publish(
              amqpUtils.DIRECT_EXCHANGE,
              'consume-tx-key',
              new Buffer('hello')
            )
          })
        })
      })
    })
  })
})
