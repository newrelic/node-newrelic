'use strict'

var test = require('tap').test
var logger = require('../../../lib/logger')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')


var DBUSER = 'test_user'
var DBNAME = 'agent_integration'
var DBTABLE = 'test'


test('MySQL instrumentation with a connection pool and node-mysql 2.0+',
     {timeout : 30 * 1000},
     function (t) {
  t.plan(11)

  helper.bootstrapMySQL(function cb_bootstrapMySQL(error, app) {
    // set up the instrumentation before loading MySQL
    var agent = helper.instrumentMockedAgent()
    var mysql   = require('mysql')
      , generic = require('generic-pool')


    /*
     *
     * SETUP
     *
     */
    var poolLogger = logger.child({component : 'pool'})
    var pool = generic.Pool({
      name              : 'mysql',
      min               : 2,
      max               : 6,
      idleTimeoutMillis : 250,

      log : function (message) { poolLogger.info(message); },

      create : function (callback) {
        var client = mysql.createConnection({
          user     : DBUSER,
          database : DBNAME,
          host     : params.mysql_host,
          port     : params.mysql_port
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
            }
            else {
              return callback(new Error('Couldn\'t connect to DB after 10 attempts.'))
            }
          }
          else {
            callback(null, client)
          }
        })
      },

      release : function (client) {
        pool.release(client)
      }
    }

    var dal = {
      lookup : function (params, callback) {
        if (!params.id) return callback(new Error('Must include ID to look up.'))

        withRetry.getClient(function cb_getClient(err, client) {
          if (err) return callback(err)

          client.query('SELECT *' +
                       '  FROM ' + DBNAME + '.' + DBTABLE +
                       ' WHERE id = ?',
                       [params.id],
                       function (err, results) {
            withRetry.release(client); // always release back to the pool

            if (err) return callback(err)

            callback(null, results.length ? results[0] : results)
          })
        })
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

    /*
     *
     * TEST GOES HERE
     *
     */
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      dal.lookup({id : 1}, function (error, row) {
        if (error) {
          t.fail(error)
          return t.end()
        }

        var transaction = agent.getTransaction()
        if (!transaction) {
          t.fail('transaction should be visible')
          return t.end()
        }

        t.equals(row.id, 1, 'node-mysql should still work (found id)')
        t.equals(row.test_value, 'hamburgefontstiv',
                 'mysql driver should still work (found value)')

        transaction.end()

        var trace = transaction.trace
        t.ok(trace, 'trace should exist')
        t.ok(trace.root, 'root element should exist.')
        t.equals(trace.root.children.length, 2, 'There should be only one child.')

        var selectSegment = trace.root.children[1]
        t.ok(selectSegment, 'trace segment for first SELECT should exist')
        t.equals(selectSegment.name,
                 'Datastore/statement/MySQL/agent_integration.test/select',
                 'should register as SELECT')

        t.equals(selectSegment.children.length, 1, 'should only have a callback segment')
        t.equals(selectSegment.children[0].name, 'Callback: anonymous')
        t.equals(
          selectSegment.children[0].children.length,
          0,
          'callback should not have children'
        )
        t.end()
      })
    })
  }.bind(this))
})
