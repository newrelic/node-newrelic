'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var setup = require('./setup')


var DBUSER = 'test_user'
var DBNAME = 'agent_integration'


tap.test('MySQL transactions', {timeout : 30000}, function(t) {
  t.plan(7)

  // set up the instrumentation before loading MySQL
  var agent = helper.instrumentMockedAgent()
  var mysql = require('mysql')

  setup(mysql, function(error) {
    t.error(error, 'should not error setting up database')

    var client = mysql.createConnection({
      user: DBUSER,
      database: DBNAME,
      host: params.mysql_host,
      port: params.mysql_port
    })

    t.tearDown(function() {
      helper.unloadAgent(agent)
      client.end()
    })

    t.notOk(agent.getTransaction(), "no transaction should be in play yet")
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), "we should be in a transaction")
      client.beginTransaction(function(err) {
        if (!t.error(err, 'should not error')) {
          return t.end()
        }

        // trying the object mode of client.query
        client.query({sql: 'SELECT 1', timeout: 2000}, function(err) {
          if (!t.error(err, 'should not error')) {
            return t.end()
          }

          client.commit(function(err) {
            if (!t.error(err, 'should not error')) {
              return t.end()
            }

            t.ok(agent.getTransaction(), "MySQL query should not lose the transaction")
          })
        })
      })
    })
  })
})
