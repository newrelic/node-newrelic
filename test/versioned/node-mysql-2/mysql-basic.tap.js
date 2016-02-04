'use strict'

var test   = require('tap').test
var logger = require('../../../lib/logger')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')


var DBUSER = 'test_user'
var DBNAME = 'agent_integration'


test('Basic run through mysql functionality',
     {timeout : 30 * 1000},
     function (t) {
  // t.plan(9);

  helper.bootstrapMySQL(function cb_bootstrapMySQL(error, app) {
    // set up the instrumentation before loading MySQL
    var agent = helper.instrumentMockedAgent()
    var mysql   = require('mysql')
    var generic = require('generic-pool')


    /*
     *
     * SETUP
     *
     */
    var poolLogger = logger.child({component : 'pool'})
    var pool = generic.Pool({
      name: 'mysql',
      min: 2,
      max: 6,
      idleTimeoutMillis : 250,

      log : function (message) { poolLogger.info(message); },

      create : function (callback) {
        var client = mysql.createConnection({
          user: DBUSER,
          database : DBNAME,
          host: params.mysql_host,
          port: params.mysql_port
        })

        client.on('error', function (err) {
          poolLogger.error('MySQL connection errored out, destroying connection')
          poolLogger.error(err)
          pool.destroy(client)
        })

        client.connect(function cb_connect(err) {
          if (err) {
            poolLogger.error('MySQL client failed to connect. Does database %s exist?',
                             DBNAME)
          }

          callback(err, client)
        })
      },

      destroy : function (client) {
        poolLogger.info('Destroying MySQL connection')
        client.end()
      }
    })

    var withRetry = {
      getClient : function (callback, counter) {
        if (!counter) counter = 1
        counter++

        pool.acquire(function cb_acquire(err, client) {
          if (err) {
            poolLogger.error('Failed to get connection from the pool: %s', err)

            if (counter < 10) {
              pool.destroy(client)
              withRetry.getClient(callback, counter)
            } else {
              return callback(new Error('Couldn\'t connect to DB after 10 attempts.'))
            }
          } else {
            callback(null, client)
          }
        })
      },

      release : function (client) {
        pool.release(client)
      }
    }

    if (error) {
      t.fail(error)
      return t.end()
    }

    this.tearDown(function cb_tearDown() {
      pool.drain(function() {
        pool.destroyAllNow()
        helper.unloadAgent(agent)
      })
    })

    t.plan(7)

    t.test('basic transaction', function testTransaction(t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        t.ok(agent.getTransaction(), 'we should be in a transaction')

        withRetry.getClient(function cb_getClient(err, client) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          client.query('SELECT 1', function (err) {
            if (err) return t.fail(err)

            t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            withRetry.release(client)
            agent.getTransaction().end(function checkQueries() {
              var queryKeys = Object.keys(agent.queries.samples)
              t.ok(queryKeys.length > 0, 'there should be a query sample')
              queryKeys.forEach(function testSample (key) {
                var query = agent.queries.samples[key]
                t.ok(query.total > 0, 'the samples should have positive duration')
              })
              t.end()
            })
          })
        })
      })
    })

    t.test('query with values', function testCallbackOnly(t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        t.ok(agent.getTransaction(), 'we should be in a transaction')

        withRetry.getClient(function cb_getClient(err, client) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          client.query('SELECT 1', [], function (err) {
            if (err) return t.fail(err)

            t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            withRetry.release(client)
            agent.getTransaction().end(function checkQueries() {
              var queryKeys = Object.keys(agent.queries.samples)
              t.ok(queryKeys.length > 0, 'there should be a query sample')
              queryKeys.forEach(function testSample (key) {
                var query = agent.queries.samples[key]
                t.ok(query.total > 0, 'the samples should have positive duration')
              })
              t.end()
            })
          })
        })
      })
    })

    t.test('query with options streaming should work', function testCallbackOnly(t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        t.ok(agent.getTransaction(), 'we should be in a transaction')

        withRetry.getClient(function cb_getClient(err, client) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          var query = client.query('SELECT 1', [])
          var results = false

          query.on('result', function () {
            results = true
          })

          query.on('error', function (err) {
            if (err) return t.fail(err)
          })

          query.on('end', function () {
            t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            withRetry.release(client)
            t.ok(results, 'results should be received')
            agent.getTransaction().end(function checkQueries() {
              var queryKeys = Object.keys(agent.queries.samples)
              t.ok(queryKeys.length > 0, 'there should be a query sample')
              queryKeys.forEach(function testSample (key) {
                var query = agent.queries.samples[key]
                t.ok(query.total > 0, 'the samples should have positive duration')
              })
              t.end()
            })
          })
        })
      })
    })

    t.test('streaming query should be timed correctly', function testCB(t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        t.ok(agent.getTransaction(), 'we should be in a transaction')

        withRetry.getClient(function cb_getClient(err, client) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          var query = client.query('SELECT 1', [])
          var start = Date.now()
          var duration = null
          var results = false
          var ended = false

          query.on('result', function () {
            results = true
          })

          query.on('error', function (err) {
            if (err) return t.fail(err, 'streaming should not fail')
          })

          setTimeout(function actualEnd() {
            agent.getTransaction().end(function checkQueries(transaction) {
              withRetry.release(client)
              t.ok(results && ended, 'result and end events should occur')
              var traceRoot = transaction.trace.root
              var traceRootDuration = traceRoot.timer.getDurationInMillis()
              var queryNodeDuration = traceRoot.children[0].timer.getDurationInMillis()
              t.ok(Math.abs(duration - queryNodeDuration) < 1,
                  'query duration should be roughly be the time between query and end')
              t.ok(traceRootDuration - queryNodeDuration > 900,
                  'query duration should be small compared to transaction duration')
              t.end()
            })
          }, 1000)

          query.on('end', function () {
            duration = Date.now() - start
            ended = true
          })
        })
      })
    })

    t.test('streaming query children should nest correctly', function testCB(t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        t.ok(agent.getTransaction(), 'we should be in a transaction')

        withRetry.getClient(function cb_getClient(err, client) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          var query = client.query('SELECT 1', [])

          query.on('result', function () {
            setTimeout(function () {
            }, 10)
          })

          query.on('error', function (err) {
            if (err) return t.fail(err, 'streaming should not fail')
          })

          query.on('end', function () {
            setTimeout(function actualEnd() {
              agent.getTransaction().end(function checkQueries(transaction) {
                withRetry.release(client)
                var traceRoot = transaction.trace.root
                var querySegment = traceRoot.children[0]
                t.ok(querySegment.children.length === 2,
                     'the query segment should have two children')
                querySegment.children.forEach(function (childSegment) {
                  t.ok(childSegment.name === 'timers.setTimeout',
                       'children should be timeouts')
                })
                t.end()
              })
            }, 1000)
          })
        })
      })
    })

    t.test('query with options object rather than sql', function testCallbackOnly(t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        t.ok(agent.getTransaction(), 'we should be in a transaction')

        withRetry.getClient(function cb_getClient(err, client) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          client.query({sql: 'SELECT 1'}, function (err) {
            if (err) return t.fail(err)

            t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            withRetry.release(client)
            agent.getTransaction().end(function checkQueries() {
              var queryKeys = Object.keys(agent.queries.samples)
              t.ok(queryKeys.length > 0, 'there should be a query sample')
              queryKeys.forEach(function testSample (key) {
                var query = agent.queries.samples[key]
                t.ok(query.total > 0, 'the samples should have positive duration')
              })
              t.end()
            })
          })
        })
      })
    })

    t.test('query with options object and values', function testCallbackOnly(t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        t.ok(agent.getTransaction(), 'we should be in a transaction')

        withRetry.getClient(function cb_getClient(err, client) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          client.query({sql: 'SELECT 1'}, [], function (err) {
            if (err) return t.fail(err)

            t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            withRetry.release(client)
            agent.getTransaction().end(function checkQueries() {
              var queryKeys = Object.keys(agent.queries.samples)
              t.ok(queryKeys.length > 0, 'there should be a query sample')
              queryKeys.forEach(function testSample (key) {
                var query = agent.queries.samples[key]
                t.ok(query.total > 0, 'the samples should have positive duration')
              })
              t.end()
            })
          })
        })
      })
    })
  }.bind(this))
})
