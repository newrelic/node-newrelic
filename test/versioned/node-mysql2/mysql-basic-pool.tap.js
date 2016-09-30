'use strict'

var test = require('tap').test
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

test('See if mysql is running', function(t) {
  var agent = helper.instrumentMockedAgent()
  var mysql = require('mysql2')
  var pool

  t.tearDown(function() {
    helper.unloadAgent(agent)
    pool && pool.end()
  })

  helper.bootstrapMySQL(function cb_bootstrapMySQL() {
    // set up the instrumentation before loading MySQL
    pool = mysql.createPool(config)

    pool.query('SELECT 1 + 1 AS solution', function(err) {
      if (err) {
        throw new Error('Are you sure mysql is running at ' + config.host)
      }
      t.end()
    })
  })
})

test('bad config', function(t) {
  t.autoend()

  var agent = helper.instrumentMockedAgent()
  var mysql = require('mysql2')
  var poolCluster = null

  t.tearDown(function() {
    helper.unloadAgent(agent)
    poolCluster && poolCluster.end()
  })

  var badConfig = {
    connectionLimit : 10,
    host            : 'nohost',
    user            : DBUSER,
    database        : DBNAME,
  }

  t.test('multiwrap', function(_t) {
    poolCluster = mysql.createPoolCluster()

    poolCluster.add(badConfig) // anonymous group
    poolCluster.getConnection(function(err) {
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
})

// TODO: test variable argument calling
// TODO: test error conditions
// TODO: test .query without callback
// TODO: test notice errors
// TODO: test sql capture
test('mysql built-in connction pools', {timeout : 30 * 1000}, function(t) {
  var agent
  var pool
  var mysql

  helper.bootstrapMySQL(function cb_bootstrapMySQL(error) {
    t.autoend()
    t.notOk(error, 'setup should not error')

    // set up the instrumentation before loading MySQL
    t.beforeEach(function(done) {
      agent = helper.instrumentMockedAgent()
      mysql = require('mysql2')
      pool  = mysql.createPool(config)
      done()
    })

    t.afterEach(function(done) {
      pool.end(function() {
        mysql = null
        helper.unloadAgent(agent)
        done()
      })
    })


    // make sure a connection exists in the pool before any tests are run
    // we want to make sure connections are allocated outside any transaction
    // this is to avoid tests that 'happen' to work because of how CLS works
    t.test('primer', function(_t) {
      pool.query('SELECT 1 + 1 AS solution', function(err) {
        _t.notOk(err, 'are you sure mysql is running?')
        _t.notOk(agent.getTransaction(), 'transaction should not exist')
        _t.end()
      })
    })

    t.test('ensure host and port are set on segment', function(_t) {
      helper.runInTransaction(agent, function transactionInScope() {
        pool.query('SELECT 1 + 1 AS solution', function(err) {
          var seg = agent.tracer.getTransaction().trace.root.children[0]
          _t.notOk(err, 'no errors')
          _t.ok(seg, 'there is a sgment')
          _t.equal(seg.host, config.host, 'set host')
          _t.equal(seg.port, config.port, 'set port')
          agent.getTransaction().end()

          _t.end()
        })
      })
    })

    t.test('query with error', function(_t) {
      helper.runInTransaction(agent, function transactionInScope() {
        pool.query('BLARG', function(err) {
          _t.ok(err)
          _t.ok(agent.getTransaction(), 'transaction should exist')
          agent.getTransaction().end()

          _t.end()
        })
      })
    })

    t.test('pool.query', function(_t) {
      helper.runInTransaction(agent, function transactionInScope() {
        pool.query('SELECT 1 + 1 AS solution123123123123', function(err) {
          var transxn = agent.getTransaction()
          var segment = agent.tracer.getSegment().parent

          _t.ifError(err, 'no error ocurred')
          _t.ok(transxn, 'transaction should exit')
          _t.ok(segment, 'segment should exit')
          _t.ok(segment.timer.start > 0, 'starts at a postitive time')
          _t.ok(segment.timer.start <= Date.now(), 'starts in past')
          _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          agent.getTransaction().end()

          _t.end()
        })
      })
    })

    t.test('pool.query with values', function(_t) {
      helper.runInTransaction(agent, function transactionInScope() {
        pool.query('SELECT ? + ? AS solution', [1, 1], function(err) {
          var transxn = agent.getTransaction()
          var segment = agent.tracer.getSegment().parent

          _t.ifError(err, 'no error ocurred')
          _t.ok(transxn, 'transaction should exit')
          _t.ok(segment, 'segment should exit')
          _t.ok(segment.timer.start > 0, 'starts at a postitive time')
          _t.ok(segment.timer.start <= Date.now(), 'starts in past')
          _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          agent.getTransaction().end()

          _t.end()
        })
      })
    })

    t.test('pool.getConnection -> connection.query', function(_t) {
      helper.runInTransaction(agent, function transactionInScope() {
        pool.getConnection(function shouldBeWrapped(err, connection) {
          _t.ifError(err, 'should not have error')
          _t.ok(agent.getTransaction(), 'transaction should exit')

          connection.query('SELECT 1 + 1 AS solution', function(err) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            agent.getTransaction().end()
            connection.release()

            _t.end()
          })
        })
      })
    })

    t.test('pool.getConnection -> connection.query with placeholders', function(_t) {
      helper.runInTransaction(agent, function transactionInScope() {
        pool.getConnection(function shouldBeWrapped(err, connection) {
          _t.ifError(err, 'should not have error')
          _t.ok(agent.getTransaction(), 'transaction should exit')

          connection.query('SELECT ? + ? AS solution', [1, 1], function(err) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            agent.getTransaction().end()
            connection.release()

            _t.end()
          })
        })
      })
    })
  })
})

test('poolCluster', {timeout : 30 * 1000}, function(t) {
  var agent
  var mysql
  var poolCluster

  helper.bootstrapMySQL(function cb_bootstrapMySQL(error) {
    t.autoend()
    t.notOk(error, 'setup should not error')

    // set up the instrumentation before loading MySQL
    t.beforeEach(function(done) {
      agent = helper.instrumentMockedAgent()
      mysql = require('mysql2')
      poolCluster = mysql.createPoolCluster()
      done()
    })

    t.afterEach(function(done) {
      poolCluster.end()
      mysql = null
      helper.unloadAgent(agent)
      done()
    })

    t.test('primer', function(_t) {
      poolCluster.add(config)  // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.getConnection(function(err, connection) {
        _t.ifError(err, 'should not be an error')
        _t.notOk(agent.getTransaction(), 'transaction should not exist')

        connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
          _t.ifError(err)
          _t.notOk(agent.getTransaction(), 'transaction should not exist')
          connection.release()

          _t.end()
        })
      })
    })

    t.test('get any connection', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function(txn) {
        poolCluster.getConnection(function(err, connection) {
          _t.ifError(err, 'should not have error')
          _t.ok(agent.getTransaction(), 'transaction should exit')
          _t.equal(agent.getTransaction(), txn, 'transaction must be original')
          txn.end()
          connection.release()

          _t.end()
        })
      })
    })

    t.test('get any connection', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.getConnection(function(err, connection) {
        _t.ifError(err, 'should not have error')

        helper.runInTransaction(agent, function(txn) {
          connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            txn.end()
            connection.release()

            _t.end()
          })
        })
      })
    })

    t.test('get MASTER connection', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function(txn) {
        poolCluster.getConnection('MASTER', function(err, connection) {
          _t.notOk(err)
          _t.ok(agent.getTransaction())
          _t.strictEqual(agent.getTransaction(), txn)
          txn.end()
          connection.release()

          _t.end()
        })
      })
    })

    t.test('get MASTER connection', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.getConnection('MASTER', function(err, connection) {
        helper.runInTransaction(agent, function(txn) {
          connection.query('SELECT ? + ? AS solution', [1, 1], function(err) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            txn.end()
            connection.release()

            _t.end()
          })
        })
      })
    })

    t.test('get glob', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function(txn) {
        poolCluster.getConnection('REPLICA*', 'ORDER', function(err, connection) {
          _t.notOk(err)
          _t.ok(agent.getTransaction())
          _t.strictEqual(agent.getTransaction(), txn)
          txn.end()
          connection.release()

          _t.end()
        })
      })
    })

    t.test('get glob', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.getConnection('REPLICA*', 'ORDER', function(err, connection) {
        helper.runInTransaction(agent, function(txn) {
          connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            txn.end()
            connection.release()

            _t.end()
          })
        })
      })
    })

    t.test('get star', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function() {
        poolCluster.of('*').getConnection(function(err, connection) {
          _t.notOk(err)
          _t.ok(agent.getTransaction(), 'transaction should exist')
          agent.getTransaction().end()
          connection.release()

          _t.end()
        })
      })
    })

    t.test('get star', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      poolCluster.of('*').getConnection(function(err, connection) {
        helper.runInTransaction(agent, function(txn) {
          connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            txn.end()
            connection.release()

            _t.end()
          })
        })
      })
    })

    t.test('get wildcard', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      helper.runInTransaction(agent, function() {
        var pool = poolCluster.of('REPLICA*', 'RANDOM')
        pool.getConnection(function(err, connection) {
          _t.notOk(err)
          _t.ok(agent.getTransaction(), 'should have transaction')
          agent.getTransaction().end()
          connection.release()

          _t.end()
        })
      })
    })

    t.test('get wildcard with query', function(_t) {
      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      var pool = poolCluster.of('REPLICA*', 'RANDOM')
      pool.getConnection(function(err, connection) {
        helper.runInTransaction(agent, function(txn) {
          connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
            var transxn = agent.getTransaction()
            var segment = agent.tracer.getSegment().parent

            _t.ifError(err, 'no error ocurred')
            _t.ok(transxn, 'transaction should exit')
            _t.strictEqual(transxn, txn, 'transaction must be same')
            _t.ok(segment, 'segment should exit')
            _t.ok(segment.timer.start > 0, 'starts at a postitive time')
            _t.ok(segment.timer.start <= Date.now(), 'starts in past')
            _t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            txn.end()
            connection.release()

            _t.end()
          })
        })
      })
    })
  })
})
