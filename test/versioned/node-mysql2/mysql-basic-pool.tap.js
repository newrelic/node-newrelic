'use strict'

var assert = require('assert')
var test = require('tap').test
var logger = require('../../../lib/logger')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')


var DBUSER = 'test_user'
var DBNAME = 'agent_integration'

var config = {
    connectionLimit : 10,
    host : params.mysql_host,
    port : params.mysql_port,
    user : DBUSER,
    database : DBNAME,
  }


// we use this to uniquely identify transactions in each test
var uid_counter = 0

test('See if mysql is running', function(t){
  var agent
  var mysql
  var pool


  helper.bootstrapMySQL(function cb_bootstrapMySQL(error, app) {
    // set up the instrumentation before loading MySQL
    agent = helper.instrumentMockedAgent()
    mysql = require('mysql')
    pool  = mysql.createPool(config)

    pool.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
      if (err) {
        throw new Error('Are you sure mysql is running at ' + config.host)
      }
      t.end()
      helper.unloadAgent(agent)
      pool.end()
    })
  })

})

test('bad config', function (t) {
  var agent
  var badConfig
  var mysql

  agent = helper.instrumentMockedAgent()
  mysql = require('mysql')

  badConfig = {
    connectionLimit : 10,
    host            : 'nohost',
    user            : DBUSER,
    database        : DBNAME,
  }

  t.test(function(_t){
    var poolCluster = mysql.createPoolCluster()
    var getConnection = poolCluster.getConnection

    poolCluster.add(badConfig); // anonymous group
    poolCluster.getConnection(function(err, connection){

      // umm... so this test is pretty hacky, but i want to make sure we don't
      // wrap the callback multiple times.

      var stack = new Error().stack
      var frames = stack.split('\n').slice(3,8)

      _t.notEqual(frames[0], frames[1], 'do not multi-wrap')
      _t.notEqual(frames[0], frames[2], 'do not multi-wrap')
      _t.notEqual(frames[0], frames[3], 'do not multi-wrap')
      _t.notEqual(frames[0], frames[4], 'do not multi-wrap')

      _t.ok(err, 'should be an error')
      _t.end()
    })
  })

  this.tearDown(function(){
    helper.unloadAgent(agent)
  })

})

// TODO: test variable argument calling
// TODO: test error conditions
// TODO: test .query without callback
// TODO: test notice errors
// TODO: test sql capture
test('mysql built-in connction pools', {timeout : 30 * 1000}, function (t) {
  var agent
  var pool
  var mysql

  helper.bootstrapMySQL(function cb_bootstrapMySQL(error, app) {
    // set up the instrumentation before loading MySQL
    agent = helper.instrumentMockedAgent()
    mysql = require('mysql')
    pool  = mysql.createPool(config)

    // make sure a connection exists in the pool before any tests are run
    // we want to make sure connections are allocated outside any transaction
    // this is to avoid tests that 'happen' to work because of how CLS works
    t.test('primer', function(_t){
      pool.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
        _t.notOk(err, 'are you sure mysql is running?')
        _t.notOk(agent.getTransaction(), 'transaction should not exist')
        _t.end()
      })
    })

    t.test('ensure host and port are set on segment', function(_t) {
      helper.runInTransaction(agent, function transactionInScope(txn) {
        pool.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
          var seg = agent.tracer.getTransaction().trace.root.children[0]
          _t.notOk(err, 'no errors')
          _t.ok(seg, 'there is a sgment')
          _t.equal(seg.host, config.host, 'set host')
          _t.equal(seg.port, config.port, 'set port')
          _t.end()

          agent.getTransaction().end()
        })
      })
    })

    t.test('query with error', function(_t){
      helper.runInTransaction(agent, function transactionInScope() {
        pool.query('BLARG', function(err, rows, fields) {
          _t.ok(err)
          _t.ok(agent.getTransaction(), 'transaction should exit')
          _t.end()

          agent.getTransaction().end()
        })
      })
    })

    t.test('lack of callback does not explode', function(_t){
      helper.runInTransaction(agent, function transactionInScope() {
        pool.query('SET SESSION auto_increment_increment=1')
        _t.end()
      })
    })

    t.test('pool.query', function(_t){
      helper.runInTransaction(agent, function transactionInScope() {
        pool.query('SELECT 1 + 1 AS solution123123123123', function(err, rows, fields) {
          var transxn = agent.getTransaction()
          var segment = agent.tracer.getSegment().parent

          _t.ifError(err, 'no error ocurred')
          _t.ok(transxn, 'transaction should exit')
          _t.ok(segment, 'segment should exit')
          _t.ok(segment.timer.start > 0, 'starts at a postitive time')
          _t.ok(segment.timer.start <= Date.now(), 'starts in past')
          _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          _t.end()

          agent.getTransaction().end()
        })
      })
    })

    t.test('pool.query with values', function(_t) {
      helper.runInTransaction(agent, function transactionInScope() {
        pool.query('SELECT ? + ? AS solution', [1, 1], function(err, rows, fields) {
          var transxn = agent.getTransaction()
          var segment = agent.tracer.getSegment().parent

          _t.ifError(err, 'no error ocurred')
          _t.ok(transxn, 'transaction should exit')
          _t.ok(segment, 'segment should exit')
          _t.ok(segment.timer.start > 0, 'starts at a postitive time')
          _t.ok(segment.timer.start <= Date.now(), 'starts in past')
          _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          _t.end()

          agent.getTransaction().end()
        })
      })
    })

    t.test('pool.getConnectino -> connection.query', function(_t) {
      helper.runInTransaction(agent, function transactionInScope() {
        pool.getConnection(function shouldBeWrapped(err, connection) {
          _t.ifError(err, 'should not have error')
          _t.ok(agent.getTransaction(), 'transaction should exit')

          connection.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            _t.end()

            agent.getTransaction().end()
            connection.release()
          })
        })
      })
    })

    t.test('pool.getConnectino -> connection.query', function(_t) {
      helper.runInTransaction(agent, function transactionInScope() {
        pool.getConnection(function shouldBeWrapped(err, connection) {
          _t.ifError(err, 'should not have error')
          _t.ok(agent.getTransaction(), 'transaction should exit')

          connection.query('SELECT ? + ? AS solution', [1,1], function(err, rows, fields) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            _t.end()

            agent.getTransaction().end()
            connection.release()
          })
        })
      })
    })

  })

  this.tearDown(function(){
    pool.end()
    helper.unloadAgent(agent)
  })

})

test('poolCluster', {timeout : 30 * 1000}, function(t){
  var agent
    , mysql

  helper.bootstrapMySQL(function cb_bootstrapMySQL(error, app) {
    agent = helper.instrumentMockedAgent()

    mysql = require('mysql')

    t.test('primer', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.getConnection(function(err, connection){
        _t.ifError(err, 'should not be an error')
        _t.notOk(agent.getTransaction(), 'transaction should not exist')
        _t.end()

        connection.query('SELECT ? + ? AS solution', [1,1], function(err, rows, fields) {
          _t.ifError(err)
          _t.notOk(agent.getTransaction(), 'transaction should not exist')
          _t.end()

          connection.release()
          poolCluster.end()
        })
      })
    })

    t.test('get any connection', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function(txn){
        poolCluster.getConnection(function (err, connection) {
          _t.ifError(err, 'should not have error')
          _t.ok(agent.getTransaction(), 'transaction should exit')
          _t.equal(agent.getTransaction(), txn, 'transaction must be original')
          _t.end()

          txn.end()
          connection.release()
          poolCluster.end()
        })
      })
    })

    t.test('get any connection', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.getConnection(function (err, connection) {
        _t.ifError(err, 'should not have error')

        helper.runInTransaction(agent, function(txn){
          connection.query('SELECT ? + ? AS solution', [1,1], function(err, rows, fields) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            _t.end()

            txn.end()
            connection.release()
            poolCluster.end()
          })
        })
      })
    })

    t.test('get MASTER connection', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function(txn){
        poolCluster.getConnection('MASTER', function (err, connection) {
          _t.notOk(err)
          _t.ok(agent.getTransaction())
          _t.strictEqual(agent.getTransaction(), txn)
          _t.end()

          txn.end()
          connection.release()
          poolCluster.end()
        })
      })
    })


    t.test('get MASTER connection', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.getConnection('MASTER', function (err, connection) {

        helper.runInTransaction(agent, function(txn){
          connection.query('SELECT ? + ? AS solution', [1, 1], function(err, rows, fields) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            _t.end()

            txn.end()
            connection.release()
            poolCluster.end()
          })
        })

      })
    })

    t.test('get glob', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function(txn){
        poolCluster.getConnection('REPLICA*', 'ORDER', function (err, connection) {
          _t.notOk(err)
          _t.ok(agent.getTransaction())
          _t.strictEqual(agent.getTransaction(), txn)
          _t.end()

          txn.end()
          connection.release()
          poolCluster.end()
        })
      })
    })

    t.test('get glob', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.getConnection('REPLICA*', 'ORDER', function (err, connection) {

        helper.runInTransaction(agent, function(txn){
          connection.query('SELECT ? + ? AS solution', [1,1], function(err, rows, fields) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            _t.end()

            txn.end()
            connection.release()
            poolCluster.end()
          })
        })

      })
    })

    t.test('get star', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function(){
        poolCluster.of('*').getConnection(function (err, connection) {
          _t.notOk(err)
          _t.ok(agent.getTransaction(), 'transaction should exist')
          _t.end()

          agent.getTransaction().end()
          connection.release()
          poolCluster.end()
        })
      })
    })

    t.test('get star', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.of('*').getConnection(function (err, connection) {

        helper.runInTransaction(agent, function(txn){
          connection.query('SELECT ? + ? AS solution', [1,1], function(err, rows, fields) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            _t.end()

            txn.end()
            connection.release()
            poolCluster.end()
          })
        })

      })
    })

    t.test('get wildcard', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function(){
        var pool = poolCluster.of('REPLICA*', 'RANDOM')
        pool.getConnection(function (err, connection) {
          _t.notOk(err)
          _t.ok(agent.getTransaction(), 'should have transaction')
          _t.end()

          agent.getTransaction().end()
          connection.release()
          poolCluster.end()
        })
      })
    })

    t.test('get wildcard', function(_t){
      var poolCluster = mysql.createPoolCluster()

      poolCluster.add(config); // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      var pool = poolCluster.of('REPLICA*', 'RANDOM')
      pool.getConnection(function (err, connection) {

        helper.runInTransaction(agent, function(txn){
          connection.query('SELECT ? + ? AS solution', [1,1], function(err, rows, fields) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            _t.end()

            txn.end()
            connection.release()
            poolCluster.end()
          })
        })

      })
    })
  })

  this.tearDown(function(){
    helper.unloadAgent(agent)
  })

})
