'use strict'

var test   = require('tap').test
  , helper = require('../../lib/agent_helper')
  , params = require('../../lib/params')


var DBUSER = 'test_user'
  , DBNAME = 'agent_integration'


test('MySQL transactions',
     {timeout : 30 * 1000},
     function (t) {
  t.plan(3);

  helper.bootstrapMySQL(function cb_bootstrapMySQL(error, app) {
    // set up the instrumentation before loading MySQL
    var agent = helper.instrumentMockedAgent()
    var mysql = require('mysql')
    var client = mysql.createConnection({
      user     : DBUSER,
      database : DBNAME,
      host     : params.mysql_host,
      port     : params.mysql_port
    })

    if (error) {
      t.fail(error)
      return t.end()
    }

    this.tearDown(function cb_tearDown() {
      helper.unloadAgent(agent)
      client.end()
    })

    /*
     *
     * TEST GOES HERE
     *
     */
    t.notOk(agent.getTransaction(), "no transaction should be in play yet")
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), "we should be in a transaction")
      client.beginTransaction(function (err) {
        if (err) return t.fail(err)
        // trying the object mode of client.query
        client.query({sql: 'SELECT 1', timeout: 10}, function (err) {
          if (err) return t.fail(err)
          client.commit(function (err) {
            if (err) return t.fail(err)
            t.ok(agent.getTransaction(), "MySQL query should not lose the transaction")
          })
        })
      })
    })
  }.bind(this))
})
