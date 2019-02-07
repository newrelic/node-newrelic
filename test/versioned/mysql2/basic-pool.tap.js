'use strict'

var fs = require('fs')
var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var urltils = require('../../../lib/util/urltils')
var exec = require('child_process').exec
var setup = require('./setup')

var DBUSER = 'root'
var DBNAME = 'agent_integration'


var config = getConfig({})
function getConfig(extras) {
  var conf = {
    connectionLimit: 10,
    host: params.mysql_host,
    port: params.mysql_port,
    user: DBUSER,
    database: DBNAME
  }

  for (var key in extras) { // eslint-disable-line guard-for-in
    conf[key] = extras[key]
  }

  return conf
}

tap.test('See if mysql is running', function(t) {
  setup(require('mysql2'), function(err) {
    t.error(err, 'should not fail to set up mysql database')
    t.end()
  })
})

tap.test('bad config', function(t) {
  t.autoend()

  var agent = helper.instrumentMockedAgent()
  var mysql = require('mysql2')
  var badConfig = {
    connectionLimit: 10,
    host: 'nohost',
    user: DBUSER,
    database: DBNAME,
  }

  t.test(function(t) {
    var poolCluster = mysql.createPoolCluster()
    t.tearDown(function() { poolCluster.end() })

    poolCluster.add(badConfig) // anonymous group
    poolCluster.getConnection(function(err) {
      // umm... so this test is pretty hacky, but i want to make sure we don't
      // wrap the callback multiple times.

      var stack = new Error().stack
      var frames = stack.split('\n').slice(3,8)

      t.notEqual(frames[0], frames[1], 'do not multi-wrap')
      t.notEqual(frames[0], frames[2], 'do not multi-wrap')
      t.notEqual(frames[0], frames[3], 'do not multi-wrap')
      t.notEqual(frames[0], frames[4], 'do not multi-wrap')

      t.ok(err, 'should be an error')
      t.end()
    })
  })

  t.tearDown(function() {
    helper.unloadAgent(agent)
  })
})

// TODO: test variable argument calling
// TODO: test error conditions
// TODO: test .query without callback
// TODO: test notice errors
// TODO: test sql capture
tap.test('mysql2 built-in connection pools', {timeout : 30 * 1000}, function(t) {
  t.autoend()

  var agent = null
  var mysql = null
  var pool = null

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    mysql = require('mysql2')
    pool = mysql.createPool(config)
    setup(mysql, done)
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    pool.end(done)

    agent = null
    mysql = null
    pool = null
  })

  // make sure a connection exists in the pool before any tests are run
  // we want to make sure connections are allocated outside any transaction
  // this is to avoid tests that 'happen' to work because of how CLS works
  t.test('primer', function(t) {
    pool.query('SELECT 1 + 1 AS solution', function(err) {
      t.notOk(err, 'are you sure mysql is running?')
      t.notOk(agent.getTransaction(), 'transaction should not exist')
      t.end()
    })
  })

  t.test('ensure host and port are set on segment', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('SELECT 1 + 1 AS solution', function(err) {
        // depending on the minor version of mysql2,
        // relevant segment is either first or second index
        var seg = txn.trace.root.children[0].children.filter(function(trace) {
          return /Datastore\/statement\/MySQL/.test(trace.name)
        })[0]
        const attributes = seg.getAttributes()
        t.error(err, 'should not error')
        t.ok(seg, 'should have a segment (' + (seg && seg.name) + ')')
        t.equal(
          attributes.host,
          urltils.isLocalhost(config.host)
            ? agent.config.getHostnameSafe()
            : config.host,
          'set host'
        )
        t.equal(
          attributes.database_name,
          DBNAME,
          'set database name'
        )
        t.equal(
          attributes.port_path_or_id,
          String(config.port),
          'set port'
        )
        txn.end()
        t.end()
      })
    })
  })

  t.test('respects `datastore_tracer.instance_reporting`', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      agent.config.datastore_tracer.instance_reporting.enabled = false
      pool.query('SELECT 1 + 1 AS solution', function(err) {
        var seg = getDatastoreSegment(agent.tracer.getSegment())
        const attributes = seg.getAttributes()
        t.error(err, 'should not error making query')
        t.ok(seg, 'should have a segment')

        t.notOk(
          attributes.host,
          'should have no host parameter'
        )
        t.notOk(
          attributes.port_path_or_id,
          'should have no port parameter'
        )
        t.equal(
          attributes.database_name,
          DBNAME,
          'should set database name'
        )
        agent.config.datastore_tracer.instance_reporting.enabled = true
        txn.end()
        t.end()
      })
    })
  })

  t.test('respects `datastore_tracer.database_name_reporting`', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      agent.config.datastore_tracer.database_name_reporting.enabled = false
      pool.query('SELECT 1 + 1 AS solution', function(err) {
        var seg = getDatastoreSegment(agent.tracer.getSegment())
        const attributes = seg.getAttributes()
        t.notOk(err, 'no errors')
        t.ok(seg, 'there is a segment')
        t.equal(
          attributes.host,
          urltils.isLocalhost(config.host)
            ? agent.config.getHostnameSafe()
            : config.host,
          'set host'
        )
        t.equal(
          attributes.port_path_or_id,
          String(config.port),
          'set port'
        )
        t.notOk(
          attributes.database_name,
          'should have no database name parameter'
        )
        agent.config.datastore_tracer.database_name_reporting.enabled = true
        txn.end()
        t.end()
      })
    })
  })

  t.test('ensure host is the default (localhost) when not supplied', function(t) {
    var defaultConfig = getConfig({
      host: null
    })
    var defaultPool = mysql.createPool(defaultConfig)
    helper.runInTransaction(agent, function transactionInScope(txn) {
      defaultPool.query('SELECT 1 + 1 AS solution', function(err) {
        t.error(err, 'should not fail to execute query')

        // In the case where you don't have a server running on
        // localhost the data will still be correctly associated
        // with the query.
        var seg = getDatastoreSegment(agent.tracer.getSegment())
        const attributes = seg.getAttributes()
        t.ok(seg, 'there is a segment')
        t.equal(
          attributes.host,
          agent.config.getHostnameSafe(),
          'set host'
        )
        t.equal(
          attributes.database_name,
          DBNAME,
          'set database name'
        )
        t.equal(attributes.port_path_or_id, String(defaultConfig.port), 'set port')
        txn.end()
        defaultPool.end(t.end)
      })
    })
  })

  t.test('ensure port is the default (3306) when not supplied', function(t) {
    var defaultConfig = getConfig({
      host: null
    })
    var defaultPool = mysql.createPool(defaultConfig)
    helper.runInTransaction(agent, function transactionInScope(txn) {
      defaultPool.query('SELECT 1 + 1 AS solution', function(err) {
        var seg = getDatastoreSegment(agent.tracer.getSegment())
        const attributes = seg.getAttributes()

        t.error(err, 'should not error making query')
        t.ok(seg, 'should have a segment')
        t.equal(
          attributes.host,
          urltils.isLocalhost(config.host)
            ? agent.config.getHostnameSafe()
            : config.host,
          'should set host'
        )
        t.equal(
          attributes.database_name,
          DBNAME,
          'should set database name'
        )
        t.equal(
          attributes.port_path_or_id,
          "3306",
          'should set port'
        )
        txn.end()
        defaultPool.end(t.end)
      })
    })
  })

  // The domain socket tests should only be run if there is a domain socket
  // to connect to, which only happens if there is a MySQL instance running on
  // the same box as these tests. This should always be the case on Travis,
  // but just to be sure they're running there check for the environment flag.
  getDomainSocketPath(function(socketPath) {
    var shouldTestDomain = socketPath || process.env.TRAVIS
    t.test(
      'ensure host and port are set on segment when using a domain socket',
      {skip: !shouldTestDomain},
      function(t) {
        var socketConfig = getConfig({
          socketPath: socketPath
        })
        var socketPool = mysql.createPool(socketConfig)
        helper.runInTransaction(agent, function transactionInScope(txn) {
          socketPool.query('SELECT 1 + 1 AS solution', function(err) {
            t.error(err, 'should not error making query')

            var seg = getDatastoreSegment(agent.tracer.getSegment())
            const attributes = seg.getAttributes()

            // In the case where you don't have a server running on localhost
            // the data will still be correctly associated with the query.
            t.ok(seg, 'there is a segment')
            t.equal(
              attributes.host,
              agent.config.getHostnameSafe(),
              'set host'
            )
            t.equal(
              attributes.port_path_or_id,
              socketPath,
              'set path'
            )
            t.equal(
              attributes.database_name,
              DBNAME,
              'set database name'
            )
            txn.end()
            socketPool.end(t.end)
          })
        })
      }
    )
  })

  t.test('query with error', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('BLARG', function(err) {
        t.ok(err)
        t.ok(agent.getTransaction(), 'transaction should exit')
        txn.end()
        t.end()
      })
    })
  })

  t.test('lack of callback does not explode', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('SET SESSION auto_increment_increment=1')
      setTimeout(function() {
        // without the timeout, the pool is closed before the query is able to execute
        txn.end()
        t.end()
      }, 500)
    })
  })

  t.test('pool.query', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('SELECT 1 + 1 AS solution123123123123', function(err) {
        var transxn = agent.getTransaction()
        var segment = agent.tracer.getSegment().parent

        t.ifError(err, 'no error ocurred')
        t.ok(transxn, 'transaction should exist')
        t.ok(segment, 'segment should exist')
        t.ok(segment.timer.start > 0, 'starts at a postitive time')
        t.ok(segment.timer.start <= Date.now(), 'starts in past')
        t.equal(segment.name, 'MySQL Pool#query', 'is named')
        txn.end()
        t.end()
      })
    })
  })

  t.test('pool.query with values', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('SELECT ? + ? AS solution', [1, 1], function(err) {
        var transxn = agent.getTransaction()
        t.error(err)
        t.ok(transxn, 'should not lose transaction')
        if (transxn) {
          var segment = agent.tracer.getSegment().parent
          t.ok(segment, 'segment should exist')
          t.ok(segment.timer.start > 0, 'starts at a postitive time')
          t.ok(segment.timer.start <= Date.now(), 'starts in past')
          t.equal(segment.name, 'MySQL Pool#query', 'is named')
        }

        txn.end()
        t.end()
      })
    })
  })

  t.test('pool.getConnection -> connection.query', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.getConnection(function shouldBeWrapped(err, connection) {
        t.ifError(err, 'should not have error')
        t.ok(agent.getTransaction(), 'transaction should exit')
        t.tearDown(function() { connection.release() })

        connection.query('SELECT 1 + 1 AS solution', function(err) {
          var transxn = agent.getTransaction()
          var segment = agent.tracer.getSegment().parent

          t.ifError(err, 'no error ocurred')
          t.ok(transxn, 'transaction should exist')
          t.ok(segment, 'segment should exist')
          t.ok(segment.timer.start > 0, 'starts at a postitive time')
          t.ok(segment.timer.start <= Date.now(), 'starts in past')
          t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          txn.end()
          t.end()
        })
      })
    })
  })

  t.test('pool.getConnection -> connection.query with values', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.getConnection(function shouldBeWrapped(err, connection) {
        t.ifError(err, 'should not have error')
        t.ok(agent.getTransaction(), 'transaction should exit')
        t.tearDown(function() { connection.release() })

        connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
          var transxn = agent.getTransaction()
          t.error(err)
          t.ok(transxn, 'should not lose transaction')
          if (transxn) {
            var segment = agent.tracer.getSegment().parent
            t.ok(segment, 'segment should exist')
            t.ok(segment.timer.start > 0, 'starts at a postitive time')
            t.ok(segment.timer.start <= Date.now(), 'starts in past')
            t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          }

          txn.end()
          t.end()
        })
      })
    })
  })
})

tap.test('poolCluster', {timeout : 30 * 1000}, function(t) {
  t.autoend()

  var agent = null
  var mysql = null

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    mysql = require('mysql2')
    setup(mysql, done)
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)

    agent = null
    mysql = null

    done()
  })

  t.test('primer', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.getConnection(function(err, connection) {
      t.ifError(err, 'should not be an error')
      t.notOk(agent.getTransaction(), 'transaction should not exist')

      connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
        t.ifError(err)
        t.notOk(agent.getTransaction(), 'transaction should not exist')

        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get any connection', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function(txn) {
      poolCluster.getConnection(function(err, connection) {
        t.ifError(err, 'should not have error')
        t.ok(agent.getTransaction(), 'transaction should exist')
        t.equal(agent.getTransaction(), txn, 'transaction must be original')

        txn.end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get any connection', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.getConnection(function(err, connection) {
      t.ifError(err, 'should not have error')

      helper.runInTransaction(agent, function(txn) {
        connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
          var transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.strictEqual(transxn, txn, 'transaction must be same')

          if (transxn) {
            var segment = agent.tracer.getSegment().parent
            t.ok(segment, 'segment should exist')
            t.ok(segment.timer.start > 0, 'starts at a postitive time')
            t.ok(segment.timer.start <= Date.now(), 'starts in past')
            t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          }

          t.ifError(err, 'no error ocurred')
          t.ok(transxn, 'transaction should exit')
          t.strictEqual(transxn, txn, 'transaction must be same')
          t.ok(segment, 'segment should exit')
          t.ok(segment.timer.start > 0, 'starts at a postitive time')
          t.ok(segment.timer.start <= Date.now(), 'starts in past')
          t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

          txn.end()
          connection.release()
          poolCluster.end()
          t.end()
        })
      })
    })
  })

  t.test('get MASTER connection', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function(txn) {
      poolCluster.getConnection('MASTER', function(err, connection) {
        t.notOk(err)
        t.ok(agent.getTransaction())
        t.strictEqual(agent.getTransaction(), txn)

        txn.end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })


  t.test('get MASTER connection', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.getConnection('MASTER', function(err, connection) {
      helper.runInTransaction(agent, function(txn) {
        connection.query('SELECT ? + ? AS solution', [1, 1], function(err) {
          var transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.strictEqual(transxn, txn, 'transaction must be same')

          if (transxn) {
            var segment = agent.tracer.getSegment().parent
            t.ok(segment, 'segment should exist')
            t.ok(segment.timer.start > 0, 'starts at a postitive time')
            t.ok(segment.timer.start <= Date.now(), 'starts in past')
            t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          }

          t.ifError(err, 'no error ocurred')
          t.ok(transxn, 'transaction should exit')
          t.strictEqual(transxn, txn, 'transaction must be same')
          t.ok(segment, 'segment should exit')
          t.ok(segment.timer.start > 0, 'starts at a postitive time')
          t.ok(segment.timer.start <= Date.now(), 'starts in past')
          t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

          txn.end()
          connection.release()
          poolCluster.end()
          t.end()
        })
      })
    })
  })

  t.test('get glob', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function(txn) {
      poolCluster.getConnection('REPLICA*', 'ORDER', function(err, connection) {
        t.notOk(err)
        t.ok(agent.getTransaction())
        t.strictEqual(agent.getTransaction(), txn)

        txn.end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get glob', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.getConnection('REPLICA*', 'ORDER', function(err, connection) {
      helper.runInTransaction(agent, function(txn) {
        connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
          var transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.strictEqual(transxn, txn, 'transaction must be same')

          if (transxn) {
            var segment = agent.tracer.getSegment().parent
            t.ok(segment, 'segment should exist')
            t.ok(segment.timer.start > 0, 'starts at a postitive time')
            t.ok(segment.timer.start <= Date.now(), 'starts in past')
            t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          }

          t.ifError(err, 'no error ocurred')
          t.ok(transxn, 'transaction should exit')
          t.strictEqual(transxn, txn, 'transaction must be same')
          t.ok(segment, 'segment should exit')
          t.ok(segment.timer.start > 0, 'starts at a postitive time')
          t.ok(segment.timer.start <= Date.now(), 'starts in past')
          t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

          txn.end()
          connection.release()
          poolCluster.end()
          t.end()
        })
      })
    })
  })

  t.test('get star', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function() {
      poolCluster.of('*').getConnection(function(err, connection) {
        t.notOk(err)
        t.ok(agent.getTransaction(), 'transaction should exist')

        agent.getTransaction().end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get star', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.of('*').getConnection(function(err, connection) {
      helper.runInTransaction(agent, function(txn) {
        connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
          var transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.strictEqual(transxn, txn, 'transaction must be same')

          if (transxn) {
            var segment = agent.tracer.getSegment().parent
            t.ok(segment, 'segment should exist')
            t.ok(segment.timer.start > 0, 'starts at a postitive time')
            t.ok(segment.timer.start <= Date.now(), 'starts in past')
            t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          }

          t.ifError(err, 'no error ocurred')
          t.ok(transxn, 'transaction should exit')
          t.strictEqual(transxn, txn, 'transaction must be same')
          t.ok(segment, 'segment should exit')
          t.ok(segment.timer.start > 0, 'starts at a postitive time')
          t.ok(segment.timer.start <= Date.now(), 'starts in past')
          t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

          txn.end()
          connection.release()
          poolCluster.end()
          t.end()
        })
      })
    })
  })

  t.test('get wildcard', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function() {
      var pool = poolCluster.of('REPLICA*', 'RANDOM')
      pool.getConnection(function(err, connection) {
        t.notOk(err)
        t.ok(agent.getTransaction(), 'should have transaction')

        agent.getTransaction().end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get wildcard', function(t) {
    var poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    var pool = poolCluster.of('REPLICA*', 'RANDOM')
    pool.getConnection(function(err, connection) {
      helper.runInTransaction(agent, function(txn) {
        connection.query('SELECT ? + ? AS solution', [1,1], function(err) {
          var transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.strictEqual(transxn, txn, 'transaction must be same')

          if (transxn) {
            var segment = agent.tracer.getSegment().parent
            t.ok(segment, 'segment should exist')
            t.ok(segment.timer.start > 0, 'starts at a postitive time')
            t.ok(segment.timer.start <= Date.now(), 'starts in past')
            t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          }

          t.ifError(err, 'no error ocurred')
          t.ok(transxn, 'transaction should exit')
          t.strictEqual(transxn, txn, 'transaction must be same')
          t.ok(segment, 'segment should exit')
          t.ok(segment.timer.start > 0, 'starts at a postitive time')
          t.ok(segment.timer.start <= Date.now(), 'starts in past')
          t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

          txn.end()
          connection.release()
          poolCluster.end()
          t.end()
        })
      })
    })
  })
})

function getDomainSocketPath(callback) {
  exec('mysql_config --socket', function(err, stdout, stderr) {
    if (err || stderr.toString()) {
      return callback(null)
    }

    var sock = stdout.toString().trim()
    fs.access(sock, function(err) {
      callback(err ? null : sock)
    })
  })
}

function getDatastoreSegment(segment) {
  return segment.parent.children.filter(function(s) {
    return /^Datastore/.test(s && s.name)
  })[0]
}
