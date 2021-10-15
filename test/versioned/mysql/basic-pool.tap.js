/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('fs')
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')
const exec = require('child_process').exec
const setup = require('./setup')
const { version: pkgVersion } = require('mysql/package')
const semver = require('semver')

const DBUSER = 'root'
const DBNAME = 'agent_integration'

const config = getConfig({})
function getConfig(extras) {
  const conf = {
    connectionLimit: 10,
    host: params.mysql_host,
    port: params.mysql_port,
    user: DBUSER,
    database: DBNAME
  }

  // eslint-disable-next-line guard-for-in
  for (const key in extras) {
    conf[key] = extras[key]
  }

  return conf
}

tap.test('See if mysql is running', function (t) {
  t.resolves(setup(require('mysql')))
  t.end()
})

tap.test('bad config', function (t) {
  t.autoend()

  const agent = helper.instrumentMockedAgent()
  const mysql = require('mysql')
  const badConfig = {
    connectionLimit: 10,
    host: 'nohost',
    user: DBUSER,
    database: DBNAME
  }

  t.test(function (t) {
    const poolCluster = mysql.createPoolCluster()
    t.teardown(function () {
      poolCluster.end()
    })

    poolCluster.add(badConfig) // anonymous group
    poolCluster.getConnection(function (err) {
      // umm... so this test is pretty hacky, but i want to make sure we don't
      // wrap the callback multiple times.

      const stack = new Error().stack
      const frames = stack.split('\n').slice(3, 8)

      t.not(frames[0], frames[1], 'do not multi-wrap')
      t.not(frames[0], frames[2], 'do not multi-wrap')
      t.not(frames[0], frames[3], 'do not multi-wrap')
      t.not(frames[0], frames[4], 'do not multi-wrap')

      t.ok(err, 'should be an error')
      t.end()
    })
  })

  t.teardown(function () {
    helper.unloadAgent(agent)
  })
})

// TODO: test variable argument calling
// TODO: test error conditions
// TODO: test .query without callback
// TODO: test notice errors
// TODO: test sql capture
tap.test('mysql built-in connection pools', { timeout: 30 * 1000 }, function (t) {
  let agent = null
  let mysql = null
  let pool = null

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()
    mysql = require('mysql')
    pool = mysql.createPool(config)
    return setup(mysql)
  })

  t.afterEach(function () {
    return new Promise((resolve) => {
      helper.unloadAgent(agent)
      pool.end(resolve)

      agent = null
      mysql = null
      pool = null
    })
  })

  // make sure a connection exists in the pool before any tests are run
  // we want to make sure connections are allocated outside any transaction
  // this is to avoid tests that 'happen' to work because of how CLS works
  t.test('primer', function (t) {
    pool.query('SELECT 1 + 1 AS solution', function (err) {
      t.notOk(err, 'are you sure mysql is running?')
      t.notOk(agent.getTransaction(), 'transaction should not exist')
      t.end()
    })
  })

  t.test('ensure host and port are set on segment', function (t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('SELECT 1 + 1 AS solution', function (err) {
        let seg = txn.trace.root.children[0].children[1]
        // 2.16 introduced an extra segment
        if (seg && seg.name === 'timers.setTimeout') {
          seg = txn.trace.root.children[0].children[2]
        }
        const attributes = seg.getAttributes()
        t.error(err, 'should not error')
        t.ok(seg, 'should have a segment (' + (seg && seg.name) + ')')
        t.equal(
          attributes.host,
          urltils.isLocalhost(config.host) ? agent.config.getHostnameSafe() : config.host,
          'set host'
        )
        t.equal(attributes.database_name, DBNAME, 'set database name')
        t.equal(attributes.port_path_or_id, String(config.port), 'set port')
        t.equal(attributes.product, 'MySQL', 'set product attribute')
        txn.end()
        t.end()
      })
    })
  })

  t.test('respects `datastore_tracer.instance_reporting`', function (t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      agent.config.datastore_tracer.instance_reporting.enabled = false
      pool.query('SELECT 1 + 1 AS solution', function (err) {
        const seg = getDatastoreSegment(agent.tracer.getSegment())
        t.error(err, 'should not error making query')
        t.ok(seg, 'should have a segment')
        const attributes = seg.getAttributes()

        t.notOk(attributes.host, 'should have no host parameter')
        t.notOk(attributes.port_path_or_id, 'should have no port parameter')
        t.equal(attributes.database_name, DBNAME, 'should set database name')
        t.equal(attributes.product, 'MySQL', 'should set product attribute')
        agent.config.datastore_tracer.instance_reporting.enabled = true
        txn.end()
        t.end()
      })
    })
  })

  t.test('respects `datastore_tracer.database_name_reporting`', function (t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      agent.config.datastore_tracer.database_name_reporting.enabled = false
      pool.query('SELECT 1 + 1 AS solution', function (err) {
        const seg = getDatastoreSegment(agent.tracer.getSegment())
        const attributes = seg.getAttributes()
        t.notOk(err, 'no errors')
        t.ok(seg, 'there is a segment')
        t.equal(
          attributes.host,
          urltils.isLocalhost(config.host) ? agent.config.getHostnameSafe() : config.host,
          'set host'
        )
        t.equal(attributes.port_path_or_id, String(config.port), 'set port')
        t.notOk(attributes.database_name, 'should have no database name parameter')
        t.equal(attributes.product, 'MySQL', 'should set product attribute')
        agent.config.datastore_tracer.database_name_reporting.enabled = true
        txn.end()
        t.end()
      })
    })
  })

  t.test('ensure host is the default (localhost) when not supplied', function (t) {
    const defaultConfig = getConfig({
      host: null
    })
    const defaultPool = mysql.createPool(defaultConfig)
    helper.runInTransaction(agent, function transactionInScope(txn) {
      defaultPool.query('SELECT 1 + 1 AS solution', function (err) {
        t.error(err, 'should not fail to execute query')

        // In the case where you don't have a server running on
        // localhost the data will still be correctly associated
        // with the query.
        const seg = getDatastoreSegment(agent.tracer.getSegment())
        const attributes = seg.getAttributes()
        t.ok(seg, 'there is a segment')
        t.equal(attributes.host, agent.config.getHostnameSafe(), 'set host')
        t.equal(attributes.database_name, DBNAME, 'set database name')
        t.equal(attributes.port_path_or_id, String(defaultConfig.port), 'set port')
        t.equal(attributes.product, 'MySQL', 'should set product attribute')
        txn.end()
        defaultPool.end(t.end)
      })
    })
  })

  t.test('ensure port is the default (3306) when not supplied', function (t) {
    const defaultConfig = getConfig({
      host: null
    })
    const defaultPool = mysql.createPool(defaultConfig)
    helper.runInTransaction(agent, function transactionInScope(txn) {
      defaultPool.query('SELECT 1 + 1 AS solution', function (err) {
        const seg = getDatastoreSegment(agent.tracer.getSegment())
        const attributes = seg.getAttributes()

        t.error(err, 'should not error making query')
        t.ok(seg, 'should have a segment')
        t.equal(
          attributes.host,
          urltils.isLocalhost(config.host) ? agent.config.getHostnameSafe() : config.host,
          'should set host'
        )
        t.equal(attributes.database_name, DBNAME, 'should set database name')
        t.equal(attributes.port_path_or_id, '3306', 'should set port')
        t.equal(attributes.product, 'MySQL', 'should set product attribute')
        txn.end()
        defaultPool.end(t.end)
      })
    })
  })

  t.test('query with error', function (t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('BLARG', function (err) {
        t.ok(err)
        t.ok(agent.getTransaction(), 'transaction should exit')
        txn.end()
        t.end()
      })
    })
  })

  t.test('lack of callback does not explode', function (t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('SET SESSION auto_increment_increment=1')
      txn.end()
      t.end()
    })
  })

  t.test('pool.query', function (t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('SELECT 1 + 1 AS solution123123123123', function (err) {
        const transxn = agent.getTransaction()
        const segment = agent.tracer.getSegment().parent

        t.error(err, 'no error ocurred')
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

  t.test('pool.query with values', function (t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.query('SELECT ? + ? AS solution', [1, 1], function (err) {
        const transxn = agent.getTransaction()
        t.error(err)
        t.ok(transxn, 'should not lose transaction')
        if (transxn) {
          const segment = agent.tracer.getSegment().parent
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

  t.test('pool.getConnection -> connection.query', function (t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.getConnection(function shouldBeWrapped(err, connection) {
        t.error(err, 'should not have error')
        t.ok(agent.getTransaction(), 'transaction should exit')
        t.teardown(function () {
          connection.release()
        })

        connection.query('SELECT 1 + 1 AS solution', function (err) {
          const transxn = agent.getTransaction()
          const segment = agent.tracer.getSegment().parent

          t.error(err, 'no error ocurred')
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

  t.test('pool.getConnection -> connection.query with values', function (t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      pool.getConnection(function shouldBeWrapped(err, connection) {
        t.error(err, 'should not have error')
        t.ok(agent.getTransaction(), 'transaction should exit')
        t.teardown(function () {
          connection.release()
        })

        connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
          const transxn = agent.getTransaction()
          t.error(err)
          t.ok(transxn, 'should not lose transaction')
          if (transxn) {
            const segment = agent.tracer.getSegment().parent
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

  // The domain socket tests should only be run if there is a domain socket
  // to connect to, which only happens if there is a MySQL instance running on
  // the same box as these tests.
  getDomainSocketPath(function (socketPath) {
    const shouldTestDomain = socketPath
    t.test(
      'ensure host and port are set on segment when using a domain socket',
      { skip: !shouldTestDomain },
      function (t) {
        const socketConfig = getConfig({
          socketPath: socketPath
        })
        const socketPool = mysql.createPool(socketConfig)
        helper.runInTransaction(agent, function transactionInScope(txn) {
          socketPool.query('SELECT 1 + 1 AS solution', function (err) {
            t.error(err, 'should not error making query')

            const seg = getDatastoreSegment(agent.tracer.getSegment())
            const attributes = seg.getAttributes()

            // In the case where you don't have a server running on localhost
            // the data will still be correctly associated with the query.
            t.ok(seg, 'there is a segment')
            t.equal(attributes.host, agent.config.getHostnameSafe(), 'set host')
            t.equal(attributes.port_path_or_id, socketPath, 'set path')
            t.equal(attributes.database_name, DBNAME, 'set database name')
            t.equal(attributes.product, 'MySQL', 'should set product attribute')
            txn.end()
            socketPool.end(t.end)
          })
        })
      }
    )

    t.end()
  })
})

tap.test('poolCluster', { timeout: 30 * 1000 }, function (t) {
  t.autoend()

  let agent = null
  let mysql = null

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()
    mysql = require('mysql')
    return setup(mysql)
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)

    agent = null
    mysql = null
  })

  t.test('primer', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.getConnection(function (err, connection) {
      t.error(err, 'should not be an error')
      t.notOk(agent.getTransaction(), 'transaction should not exist')

      connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
        t.error(err)
        t.notOk(agent.getTransaction(), 'transaction should not exist')

        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get any connection', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function (txn) {
      poolCluster.getConnection(function (err, connection) {
        t.error(err, 'should not have error')
        t.ok(agent.getTransaction(), 'transaction should exist')
        t.equal(agent.getTransaction(), txn, 'transaction must be original')

        txn.end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get any connection', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.getConnection(function (err, connection) {
      t.error(err, 'should not have error')

      helper.runInTransaction(agent, function (txn) {
        connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
          t.error(err, 'no error ocurred')
          const transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.same(transxn, txn, 'transaction must be same')
          const segment = agent.tracer.getSegment().parent
          t.ok(segment, 'segment should exist')
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

  t.test('get MASTER connection', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function (txn) {
      poolCluster.getConnection('MASTER', function (err, connection) {
        t.notOk(err)
        t.ok(agent.getTransaction())
        t.equal(agent.getTransaction(), txn)

        txn.end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get MASTER connection', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.getConnection('MASTER', function (err, connection) {
      helper.runInTransaction(agent, function (txn) {
        connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
          t.error(err, 'no error ocurred')
          const transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.same(transxn, txn, 'transaction must be same')
          const segment = agent.tracer.getSegment().parent
          t.ok(segment, 'segment should exist')
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

  t.test('get glob', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function (txn) {
      poolCluster.getConnection('REPLICA*', 'ORDER', function (err, connection) {
        t.notOk(err)
        t.ok(agent.getTransaction())
        t.equal(agent.getTransaction(), txn)

        txn.end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get glob', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.getConnection('REPLICA*', 'ORDER', function (err, connection) {
      helper.runInTransaction(agent, function (txn) {
        connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
          t.error(err, 'no error ocurred')
          const transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.same(transxn, txn, 'transaction must be same')
          const segment = agent.tracer.getSegment().parent
          t.ok(segment, 'segment should exist')
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

  t.test('get star', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function () {
      poolCluster.of('*').getConnection(function (err, connection) {
        t.notOk(err)
        t.ok(agent.getTransaction(), 'transaction should exist')

        agent.getTransaction().end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get star', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    poolCluster.of('*').getConnection(function (err, connection) {
      helper.runInTransaction(agent, function (txn) {
        connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
          t.error(err, 'no error ocurred')
          const transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.same(transxn, txn, 'transaction must be same')
          const segment = agent.tracer.getSegment().parent
          t.ok(segment, 'segment should exist')
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

  t.test('get wildcard', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    helper.runInTransaction(agent, function () {
      const pool = poolCluster.of('REPLICA*', 'RANDOM')
      pool.getConnection(function (err, connection) {
        t.notOk(err)
        t.ok(agent.getTransaction(), 'should have transaction')

        agent.getTransaction().end()
        connection.release()
        poolCluster.end()
        t.end()
      })
    })
  })

  t.test('get wildcard', function (t) {
    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(config) // anonymous group
    poolCluster.add('MASTER', config)
    poolCluster.add('REPLICA', config)

    const pool = poolCluster.of('REPLICA*', 'RANDOM')
    pool.getConnection(function (err, connection) {
      helper.runInTransaction(agent, function (txn) {
        connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
          t.error(err, 'no error ocurred')
          const transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.same(transxn, txn, 'transaction must be same')
          const segment = agent.tracer.getSegment().parent
          t.ok(segment, 'segment should exist')
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

  // not added until 2.12.0
  // https://github.com/mysqljs/mysql/blob/master/Changes.md#v2120-2016-11-02
  if (semver.satisfies(pkgVersion, '>=2.12.0')) {
    t.test('poolCluster query', function (t) {
      const poolCluster = mysql.createPoolCluster()

      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)

      const masterPool = poolCluster.of('MASTER', 'RANDOM')
      const replicaPool = poolCluster.of('REPLICA', 'RANDOM')
      helper.runInTransaction(agent, function (txn) {
        replicaPool.query('SELECT ? + ? AS solution', [1, 1], function (err) {
          let transxn = agent.getTransaction()
          t.ok(transxn, 'transaction should exist')
          t.equal(transxn, txn, 'transaction must be same')

          let segment = agent.tracer.getSegment().children[1]
          t.ok(segment, 'segment should exist')
          t.ok(segment.timer.start > 0, 'starts at a postitive time')
          t.ok(segment.timer.start <= Date.now(), 'starts in past')

          t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

          t.error(err, 'no error ocurred')
          t.ok(transxn, 'transaction should exit')
          t.equal(transxn, txn, 'transaction must be same')
          t.ok(segment, 'segment should exit')
          t.ok(segment.timer.start > 0, 'starts at a postitive time')
          t.ok(segment.timer.start <= Date.now(), 'starts in past')
          t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

          masterPool.query('SELECT ? + ? AS solution', [1, 1], function (err) {
            transxn = agent.getTransaction()
            t.ok(transxn, 'transaction should exist')
            t.equal(transxn, txn, 'transaction must be same')

            segment = agent.tracer.getSegment().children[1]
            t.ok(segment, 'segment should exist')
            t.ok(segment.timer.start > 0, 'starts at a postitive time')
            t.ok(segment.timer.start <= Date.now(), 'starts in past')

            t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

            t.error(err, 'no error ocurred')
            t.ok(transxn, 'transaction should exit')
            t.equal(transxn, txn, 'transaction must be same')
            t.ok(segment, 'segment should exit')
            t.ok(segment.timer.start > 0, 'starts at a postitive time')
            t.ok(segment.timer.start <= Date.now(), 'starts in past')
            t.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

            txn.end()
            poolCluster.end()
            t.end()
          })
        })
      })
    })
  }
})

function getDomainSocketPath(callback) {
  exec('mysql_config --socket', function (err, stdout, stderr) {
    if (err || stderr.toString()) {
      return callback(null)
    }

    const sock = stdout.toString().trim()
    fs.access(sock, function (err) {
      callback(err ? null : sock)
    })
  })
}

function getDatastoreSegment(segment) {
  return segment.parent.children.filter(function (s) {
    return /^Datastore/.test(s && s.name)
  })[0]
}
