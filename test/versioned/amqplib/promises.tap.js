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

tap.test('amqplib promise instrumentation', function(t) {
  t.autoend()

  var amqplib = null
  var conn = null
  var channel = null
  var agent = null
  var api = null

  t.beforeEach(function(done) {
    // In promise mode, amqplib loads bluebird. In our tests we unwrap the
    // instrumentation after each one. This is fine for first-order modules
    // which the test itself re-requires, but second-order modules (deps of
    // instrumented methods) are not reloaded and thus not re-instrumented. To
    // resolve this we just delete everything. Kill it all.
    Object.keys(require.cache).forEach(function(key) {
      if (/amqplib|bluebird/.test(key)) {
        delete require.cache[key]
      }
    })

    agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true
      }
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
    api.instrumentMessages('amqplib', instrumentation.instrumentPromiseAPI)

    amqplib = require('amqplib')
    amqpUtils.getChannel(amqplib)
      .then(function(result) {
        conn = result.connection
        channel = result.channel
        return channel.assertQueue('testQueue')
      })
      .then(function() { done() }, done)
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)

    if (!conn) {
      return done()
    }

    conn.close().then(done, done)
  })

  t.test('connect in a transaction', function(t) {
    helper.runInTransaction(agent, function() {
      t.doesNotThrow(function() {
        amqplib.connect(amqpUtils.CON_STRING).then(function(_conn) {
          _conn.close().then(t.end)
        }, function(err) {
          t.error(err, 'should not break connection')
          t.bailout('Can not connect to RabbitMQ, stopping tests.')
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
      channel.sendToQueue('testQueue', Buffer.from('hello'), {
        replyTo: 'my.reply.queue',
        correlationId: 'correlation-id'
      })
      tx.end()
    })
  })

  t.test('publish to fanout exchange', function(t) {
    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifyProduce(t, tx, amqpUtils.FANOUT_EXCHANGE)
      t.end()
    })

    helper.runInTransaction(agent, function(tx) {
      t.ok(agent.tracer.getSegment(), 'should start in transaction')
      channel.assertExchange(amqpUtils.FANOUT_EXCHANGE, 'fanout').then(function() {
        amqpUtils.verifyTransaction(t, tx, 'assertExchange')
        return channel.assertQueue('', {exclusive: true})
      }).then(function(result) {
        amqpUtils.verifyTransaction(t, tx, 'assertQueue')
        var queueName = result.queue
        return channel.bindQueue(queueName, amqpUtils.FANOUT_EXCHANGE)
      }).then(function() {
        amqpUtils.verifyTransaction(t, tx, 'bindQueue')
        channel.publish(amqpUtils.FANOUT_EXCHANGE, '', Buffer.from('hello'))
        tx.end()
      }).catch(function(err) {
        t.fail(err)
        t.end()
      })
    })
  })

  t.test('publish to direct exchange', function(t) {
    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifyProduce(t, tx, amqpUtils.DIRECT_EXCHANGE, 'key1')
      t.end()
    })

    helper.runInTransaction(agent, function(tx) {
      channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct').then(function() {
        amqpUtils.verifyTransaction(t, tx, 'assertExchange')
        return channel.assertQueue('', {exclusive: true})
      }).then(function(result) {
        amqpUtils.verifyTransaction(t, tx, 'assertQueue')
        var queueName = result.queue
        return channel.bindQueue(queueName, amqpUtils.DIRECT_EXCHANGE, 'key1')
      }).then(function() {
        amqpUtils.verifyTransaction(t, tx, 'bindQueue')
        channel.publish(amqpUtils.DIRECT_EXCHANGE, 'key1', Buffer.from('hello'))
        tx.end()
      }).catch(function(err) {
        t.fail(err)
        t.end()
      })
    })
  })

  t.test('purge queue', function(t) {
    var queueName = null

    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifyPurge(t, tx)
      t.end()
    })

    helper.runInTransaction(agent, function(tx) {
      channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct').then(function() {
        amqpUtils.verifyTransaction(t, tx, 'assertExchange')
        return channel.assertQueue('', {exclusive: true})
      }).then(function(result) {
        amqpUtils.verifyTransaction(t, tx, 'assertQueue')
        queueName = result.queue
        return channel.bindQueue(queueName, amqpUtils.DIRECT_EXCHANGE, 'key1')
      }).then(function() {
        amqpUtils.verifyTransaction(t, tx, 'bindQueue')
        return channel.purgeQueue(queueName)
      }).then(function() {
        amqpUtils.verifyTransaction(t, tx, 'purgeQueue')
        tx.end()
      }).catch(function(err) {
        t.fail(err)
        t.end()
      })
    })
  })

  t.test('get a message', function(t) {
    var queue = null
    var exchange = amqpUtils.DIRECT_EXCHANGE

    channel.assertExchange(exchange, 'direct').then(function() {
      return channel.assertQueue('', {exclusive: true})
    }).then(function(res) {
      queue = res.queue
      return channel.bindQueue(queue, exchange, 'consume-tx-key')
    }).then(function() {
      return helper.runInTransaction(agent, function(tx) {
        channel.publish(
          exchange,
          'consume-tx-key',
          Buffer.from('hello')
        )
        return channel.get(queue).then(function(msg) {
          t.ok(msg, 'should receive a message')

          var body = msg.content.toString('utf8')
          t.equal(body, 'hello', 'should receive expected body')

          amqpUtils.verifyTransaction(t, tx, 'get')
          channel.ack(msg)
        }).then(function() {
          tx.end()
          amqpUtils.verifyGet(t, tx, exchange, 'consume-tx-key', queue)
          t.end()
        })
      })
    }).catch(function(err) {
      t.fail(err)
      t.end()
    })
  })

  t.test('consume in a transaction with old CAT', function(t) {
    var queue = null
    var consumeTxn = null
    var exchange = amqpUtils.DIRECT_EXCHANGE

    channel.assertExchange(exchange, 'direct').then(function() {
      return channel.assertQueue('', {exclusive: true})
    }).then(function(res) {
      queue = res.queue
      return channel.bindQueue(queue, exchange, 'consume-tx-key')
    }).then(function() {
      return helper.runInTransaction(agent, function(tx) {
        return channel.consume(queue, function(msg) {
          var consumeTxnHandle = api.getTransaction()
          consumeTxn = consumeTxnHandle._transaction
          t.notEqual(consumeTxn, tx, 'should not be in original transaction')
          t.ok(msg, 'should receive a message')

          var body = msg.content.toString('utf8')
          t.equal(body, 'hello', 'should receive expected body')

          channel.ack(msg)
          tx.end()
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
        }).then(function() {
          amqpUtils.verifyTransaction(t, tx, 'consume')
        })
      }).then(function() {
        channel.publish(
          exchange,
          'consume-tx-key',
          Buffer.from('hello')
        )
      })
    }).catch(function(err) {
      t.fail(err)
      t.end()
    })
  })

  t.test('consume in a transaction with distributed tracing', function(t) {
    agent.config.distributed_tracing.enabled = true
    agent.config.account_id = 1234
    agent.config.primary_application_id = 4321
    agent.config.trusted_account_key = 1234

    var queue = null
    var consumeTxn = null
    var exchange = amqpUtils.DIRECT_EXCHANGE

    channel.assertExchange(exchange, 'direct').then(function() {
      return channel.assertQueue('', {exclusive: true})
    }).then(function(res) {
      queue = res.queue
      return channel.bindQueue(queue, exchange, 'consume-tx-key')
    }).then(function() {
      return helper.runInTransaction(agent, function(tx) {
        return channel.consume(queue, function(msg) {
          var consumeTxnHandle = api.getTransaction()
          consumeTxn = consumeTxnHandle._transaction
          t.notEqual(consumeTxn, tx, 'should not be in original transaction')
          t.ok(msg, 'should receive a message')

          var body = msg.content.toString('utf8')
          t.equal(body, 'hello', 'should receive expected body')

          channel.ack(msg)
          tx.end()
          amqpUtils.verifySubscribe(t, tx, exchange, 'consume-tx-key')
          consumeTxnHandle.end(function() {
            amqpUtils.verifyConsumeTransaction(
              t,
              consumeTxn,
              exchange,
              queue,
              'consume-tx-key'
            )
            amqpUtils.verifyDistributedTrace(t, tx, consumeTxn)
            t.end()
          })
        }).then(function() {
          amqpUtils.verifyTransaction(t, tx, 'consume')
        })
      }).then(function() {
        channel.publish(
          exchange,
          'consume-tx-key',
          Buffer.from('hello')
        )
      })
    }).catch(function(err) {
      t.fail(err)
      t.end()
    })
  })

  t.test('consume out of transaction', function(t) {
    var queue = null

    agent.on('transactionFinished', function(tx) {
      amqpUtils.verifyConsumeTransaction(
        t, tx,
        amqpUtils.DIRECT_EXCHANGE,
        queue,
        'consume-tx-key'
      )
      t.end()
    })

    channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct').then(function() {
      return channel.assertQueue('', {exclusive: true})
    }).then(function(res) {
      queue = res.queue
      return channel.bindQueue(queue, amqpUtils.DIRECT_EXCHANGE, 'consume-tx-key')
    }).then(function() {
      return channel.consume(queue, function(msg) {
        t.ok(msg, 'should receive a message')

        var body = msg.content.toString('utf8')
        t.equal(body, 'hello', 'should receive expected body')

        channel.ack(msg)

        return new Promise(function(resolve) {
          setImmediate(resolve)
        })
      }).then(function() {
        channel.publish(
          amqpUtils.DIRECT_EXCHANGE,
          'consume-tx-key',
          Buffer.from('hello')
        )
      })
    }).catch(function(err) {
      t.fail(err)
      t.end()
    })
  })

  t.test('rename message consume transaction', function(t) {
    var queue = null

    agent.on('transactionFinished', function(tx) {
      t.equal(
        tx.getFullName(), 'OtherTransaction/Message/Custom/foobar',
        'should have specified name'
      )
      t.end()
    })

    channel.assertExchange(amqpUtils.DIRECT_EXCHANGE, 'direct').then(function() {
      return channel.assertQueue('', {exclusive: true})
    }).then(function(res) {
      queue = res.queue
      return channel.bindQueue(queue, amqpUtils.DIRECT_EXCHANGE, 'consume-tx-key')
    }).then(function() {
      return channel.consume(queue, function(msg) {
        api.setTransactionName('foobar')

        channel.ack(msg)

        return new Promise(function(resolve) {
          setImmediate(resolve)
        })
      }).then(function() {
        channel.publish(
          amqpUtils.DIRECT_EXCHANGE,
          'consume-tx-key',
          Buffer.from('hello')
        )
      })
    }).catch(function(err) {
      t.fail(err)
      t.end()
    })
  })
})
