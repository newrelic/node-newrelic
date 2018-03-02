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
    agent = helper.instrumentMockedAgent(null, {
      capture_params: true
    })

    var params = {
      encoding_key: 'this is an encoding key',
      cross_process_id: '1234#4321'
    }
    agent.config._fromServer(params, 'encoding_key')
    agent.config._fromServer(params, 'cross_process_id')
    agent.config.trusted_account_ids = [1234]

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

  t.test('connect in a transaction', function(t) {
    helper.runInTransaction(agent, function() {
      t.doesNotThrow(function() {
        amqplib.connect(amqpUtils.CON_STRING, null, function(err, _conn) {
          t.error(err, 'should not break connection')
          if (!t.passing()) {
            t.bailout('Can not connect to RabbitMQ, stopping tests.')
          }
          _conn.close(t.end)
        })
      }, 'should not error when connecting')

      // If connect threw, we need to end the test immediately.
      if (!t.passing()) {
        t.end()
      }
    })
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
      amqpUtils.verifyProduce(t, tx, exchange)
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
      amqpUtils.verifyProduce(t, tx, exchange, 'key1')
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

  t.test('get a message', function(t) {
    var exchange = amqpUtils.DIRECT_EXCHANGE
    var queue = null


    channel.assertExchange(exchange, 'direct', null, function(err) {
      t.error(err, 'should not error asserting exchange')

      channel.assertQueue('', {exclusive: true}, function(err, res) {
        t.error(err, 'should not error asserting queue')
        queue = res.queue

        channel.bindQueue(queue, exchange, 'consume-tx-key', null, function(err) {
          t.error(err, 'should not error binding queue')

          helper.runInTransaction(agent, function(tx) {
            channel.publish(
              exchange,
              'consume-tx-key',
              new Buffer('hello')
            )
            channel.get(queue, {}, function(err, msg) {
              t.notOk(err, 'should not cause an error')
              t.ok(msg, 'should receive a message')

              amqpUtils.verifyTransaction(t, tx, 'get')
              var body = msg.content.toString('utf8')
              t.equal(body, 'hello', 'should receive expected body')

              channel.ack(msg)
              setImmediate(function() {
                tx.end(function() {
                  amqpUtils.verifyGet(t, tx, exchange, 'consume-tx-key', queue)
                  t.end()
                })
              })
            })
          })
        })
      })
    })
  })

  t.test('consume in a transaction', function(t) {
    var exchange = amqpUtils.DIRECT_EXCHANGE
    var queue = null


    channel.assertExchange(exchange, 'direct', null, function(err) {
      t.error(err, 'should not error asserting exchange')

      channel.assertQueue('', {exclusive: true}, function(err, res) {
        t.error(err, 'should not error asserting queue')
        queue = res.queue

        channel.bindQueue(queue, exchange, 'consume-tx-key', null, function(err) {
          t.error(err, 'should not error binding queue')

          helper.runInTransaction(agent, function(tx) {
            channel.consume(queue, function(msg) {
              var consumeTxnHandle = api.getTransaction()
              var consumeTxn = consumeTxnHandle._transaction
              t.notEqual(consumeTxn, tx, 'should not be in original transaction')
              t.ok(msg, 'should receive a message')

              var body = msg.content.toString('utf8')
              t.equal(body, 'hello', 'should receive expected body')

              channel.ack(msg)
              tx.end(function() {
                amqpUtils.verifySubscribe(t, tx, exchange, 'consume-tx-key')
                consumeTxnHandle.end(function() {
                  amqpUtils.verifyConsumeTransaction(
                    t,
                    consumeTxn,
                    exchange,
                    queue,
                    'consume-tx-key'
                  )
                  amqpUtils.verifyCAT(t, tx, consumeTxn)
                  t.end()
                })
              })
            }, null, function(err) {
              t.error(err, 'should not error subscribing consumer')
              amqpUtils.verifyTransaction(t, tx, 'consume')

              channel.publish(
                exchange,
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
      amqpUtils.verifyConsumeTransaction(t, tx, exchange, queue, 'consume-tx-key')
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
      t.equal(
        tx.getFullName(), 'OtherTransaction/Message/Custom/foobar',
        'should have specified name'
      )
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
