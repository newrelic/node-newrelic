'use strict'

var async = require('async')
var tap = require('tap')

var params = require('../../lib/params')
var helper = require('../../lib/agent_helper')

var agent = helper.instrumentMockedAgent()
var test = tap.test
var oracle

var connectData = {
  hostname: params.oracle_host,
  port: params.oracle_port,
  database: params.oracle_db,
  user: params.oracle_user,
  password: params.oracle_pass
}

//constants for table creation and db connection
var TABLE = 'testTable'
var PK = 'PK_COLUMN'
var COL = 'TEST_COLUMN'

try {
  oracle = require('oracle')
} catch (error) {
  console.error('oracle driver not installed')
}

if (oracle) {
  test('Oracle instrumentation', oracleSetup(runTest, 5))
} else if(process.env.NR_NODE_TEST_FORCE_ALL) {
  test('Oracle must be installed', function(t) {
    t.fail('Oracle must be installed')
    t.end()
  })
}

function runTest(t) {
  t.test('simple query with connectSync', connectSyncTest)
  t.test('simple query with connect', simpleConnectTest)
  t.test('query using reader and nextRow', oracleSetup(nextRowTest))
  t.test('query using reader and nextRows', oracleSetup(nextRowsTest))
  t.test(
    'simple query with prepared statement and connectSync',
    oracleSetup(preparedTest)
  )

  t.tearDown(function () {
    helper.unloadAgent(agent)
  })
}

/**
 * Deletion of testing table if already exists,
 * then recreation of a testing table
 *
 * @param Callback function to set off running the tests
 */
function oracleSetup(runTest, plan) {
  return function(t) {
    if(plan) {
      t.plan(plan)
    }

    oracle.connect(connectData, function (error, client) {
      if (error) {
        if(error.message === 'ORA-21561: OID generation failed') {
          console.error('you may need to add your hostname to your hosts file: `echo "127.0.0.1 $(hostname)" | sudo tee -a /etc/hosts`')
        }
        throw error
      }
      // todo: figure out how to do this in oracle, if exists doesn't work
      var tableDrop = 'DROP TABLE ' + TABLE
      var tableCreate = 'CREATE TABLE ' + TABLE + ' (' + PK + ' NUMBER PRIMARY KEY, '
      tableCreate += COL + ' VARCHAR2(50))'

      client.execute(tableDrop, [], function () {
        client.execute(tableCreate, [], function (err) {
          if (err) {
            throw err
          }

          client.close()
          runTest(t)
        })
      })
    })
  }
}

function getSelectSegment(setSegment, otherCallCount) {
  // loop through all of the insert segments to get to the select segment
  var getSegment = setSegment.children[0]
  for (var i = 1; i < otherCallCount; i++) {
    getSegment = getSegment.children[0]
  }
  return getSegment
}

/**
 *
 * @param t - test object
 * @param transaction - new relic transaction
 */
var verify = function (t, transaction, expected) {
  var callCount = expected.callCount || 2
  var insertCallCount = expected.insertCallCount || 1
  var selectCallCount = expected.selectCallCount || 1

  t.equal(
    Object.keys(transaction.metrics.scoped).length,
    0,
    'should not have any scoped metrics'
  )

  var unscoped = transaction.metrics.unscoped

  var expectedMetrics = {
    'Datastore/all': callCount,
    'Datastore/allOther': callCount,
    'Datastore/operation/Oracle/insert': insertCallCount,
    'Datastore/operation/Oracle/select': selectCallCount
  }

  expectedMetrics['Datastore/statement/Oracle/' + TABLE + '/insert'] = insertCallCount
  expectedMetrics['Datastore/statement/Oracle/' + TABLE + '/select'] = selectCallCount

  var expectedNames = Object.keys(expectedMetrics)
  var unscopedNames = Object.keys(unscoped)

  expectedNames.forEach(function checkName(name) {
    t.ok(unscoped[name], 'should have unscoped metric ' + name)
    if (unscoped[name]) {
      t.equals(
        unscoped[name].callCount,
        expectedMetrics[name],
        'metric ' + name + ' should have correct callCount'
      )
    }
  })

  t.equals(
    unscopedNames.length,
    expectedNames.length,
    'should have correct number of unscoped metrics'
  )

  var trace = transaction.getTrace()
  t.ok(trace, 'trace should exist')
  t.ok(trace.root, 'root element should exist')
  t.equals(
    trace.root.children.length,
    1,
    'there should be only one child of the root'
  )

  var setSegment = trace.root.children[0]

  // todo: figure out how to register host and port
  //t.equals(setSegment.host, params.oracle_host, 'should register the host')
  //t.equals(setSegment.port, params.oracle_port, 'should register the port')

  t.ok(setSegment, 'trace segment for insert should exist')
  t.equals(setSegment.name, expected.setName, 'should register the query call')

  t.equals(
    setSegment.children.length,
    1,
    'set should have an only child'
  )

  var getSegment = getSelectSegment(
    setSegment,
    insertCallCount + selectCallCount - 1
  )

  t.ok(getSegment, 'trace segment for select should exist')

  if (!getSegment) return t.end()

  t.equals(getSegment.name, expected.getName, 'should register the query call')
  t.equals(
    getSegment.children.length,
    0,
    'get should leave us here at the end'
  )

  t.ok(getSegment._isEnded(), 'trace segment should have ended')
  t.end()
}

function connectSyncTest(t) {
  t.notOk(agent.getTransaction(), 'no transaction should be in play')
  helper.runInTransaction(agent, function transactionInScope(tx) {
    var transaction = agent.getTransaction()

    t.ok(transaction, 'transaction should be visible')
    t.equal(tx, transaction, 'We got the same transaction')

    var colVal = 'Hello'
    var pkVal = 111
    var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' + COL
    insQuery += ') VALUES (:1, :2)'

    var client = oracle.connectSync(connectData)

    client.execute(insQuery, [pkVal, colVal], check)

    function check(error, ok) {
      if (error) return t.fail(error)
      t.ok(agent.getTransaction(), 'transaction should still be visible')
      t.ok(ok, 'everything should be peachy after setting')

      var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
      selQuery += PK + '=' + pkVal

      client.execute(selQuery, [], function (err, value) {
        if (err) return t.fail(err)
        t.ok(agent.getTransaction(), 'transaction should still still be visible')
        t.equals(value[0][COL], colVal, 'Oracle client should still work')

        transaction.end(function () {
          client.close()
          verify(t, transaction, {
            getName: 'Datastore/statement/Oracle/' + TABLE + '/Connection.execute/select',
            setName: 'Datastore/statement/Oracle/' + TABLE +  '/Connection.execute/insert'
          })
        })
      })
    }
  })
}

function simpleConnectTest(t) {
  t.notOk(agent.getTransaction(), 'no transaction should be in play')
  helper.runInTransaction(agent, function transactionInScope(tx) {
    var transaction = agent.getTransaction()
    t.ok(transaction, 'transaction should be visible')
    t.equal(tx, transaction, 'We got the same transaction')

    var colVal = 'Hello'
    var pkVal = 211
    var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' + COL
    insQuery += ') VALUES(:1, :2)'

    oracle.connect(connectData, check)

    function check(err, client) {
      if (err) return t.fail(err)
      client.execute(insQuery, [pkVal, colVal], function (error, ok) {
        if (error) return t.fail(error)
        t.ok(agent.getTransaction(), 'transaction should still be visible')
        t.ok(ok, 'everything should be peachy after setting')

        var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
        selQuery += PK + '=' + pkVal

        client.execute(selQuery, [], function (er, value) {
          if (er) return t.fail(er)
          t.ok(agent.getTransaction(), 'transaction should still still be visible')
          t.equals(value[0][COL], colVal, 'Oracle client should still work')

          transaction.end(function () {
            client.close()
            verify(t, transaction,  {
              getName: 'Datastore/statement/Oracle/' + TABLE + '/Connection.execute/select',
              setName: 'Datastore/statement/Oracle/' + TABLE +  '/Connection.execute/insert'
            })
          })
        })
      })
    }
  })
}

function nextRowTest(t) {
  t.notOk(agent.getTransaction(), 'no transaction should be in play')
  helper.runInTransaction(agent, function transactionInScope(tx) {
    var transaction = agent.getTransaction()
    t.ok(transaction, 'transaction should be visible')
    t.equal(tx, transaction, 'We got the same transaction')

    var colVal = 'Hello'
    var pkVal = 311
    var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' + COL
    insQuery += ') VALUES(:1, :2)'

    oracle.connect(connectData, check)

    function check(err, client) {
      if (err) return t.fail(err)

      client.execute(insQuery, [pkVal, colVal], function (error, ok) {
        if (error) return t.fail(error)
        t.ok(agent.getTransaction(), 'transaction should still be visible')
        t.ok(ok, 'everything should be peachy after setting')

        var selQuery = 'SELECT * FROM ' + TABLE
        var reader = client.reader(selQuery, [])

        reader.nextRow(function (er, row) {
          if (er) return t.fail(er)
          t.ok(agent.getTransaction(), 'transaction should still still be visible')
          t.equals(row[COL], colVal, 'Oracle client should still work')

          reader.nextRow(function (er2, row2) {
            if (er2) return t.fail(er2)
            t.ok(agent.getTransaction(), 'transaction should still still be visible')
            t.equals(row2, undefined, 'Oracle client should still work')

            transaction.end(function () {
              client.close()
              verify(t, transaction, {
                getName: 'Datastore/statement/Oracle/' + TABLE + '/Reader.nextRow/select',
                setName: 'Datastore/statement/Oracle/' + TABLE +   '/Connection.execute/insert',
                callCount: 3,
                insertCallCount: 1,
                selectCallCount: 2
              })
            })
          })
        })
      })
    }
  })
}

function nextRowsTest(t) {
  t.notOk(agent.getTransaction(), 'no transaction should be in play')
  helper.runInTransaction(agent, function transactionInScope(tx) {
    var transaction = agent.getTransaction()
    t.ok(transaction, 'transaction should be visible')
    t.equal(tx, transaction, 'We got the same transaction')

    var colVal = 'Hello'
    var pkVal = 411
    var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' + COL
    insQuery += ') VALUES(:1, :2)'

    oracle.connect(connectData, function (err, client) {
      if (err) return t.fail(err)
      var insertCount = 0
      // insert 5 rows
      async.whilst(for5, insert, testRead)

      function for5() {
        return insertCount < 5
      }

      function insert(callback) {
        client.execute(insQuery, [pkVal, colVal], function (error, ok) {
          if (error) return t.fail(error)
          t.ok(agent.getTransaction(), 'transaction should still be visible')
          t.ok(ok, 'everything should be peachy after setting')
          insertCount++
          pkVal++
          callback()
        })
      }

      function testRead() {
        var selQuery = 'SELECT * FROM ' + TABLE
        var reader = client.reader(selQuery, [])

        reader.nextRows(5, function (error, rows) {
          if (error) return t.fail(error)
          t.ok(agent.getTransaction(), 'transaction should still still be visible')
          t.equals(rows[0][COL], colVal, 'Oracle client should still work')

          var trace = transaction.getTrace()
          var getSegment = getSelectSegment(trace.root.children[0], insertCount)
          getSegment.timer.end()

          transaction.end(function () {
            client.close()
            verify(t, transaction,  {
              getName: 'Datastore/statement/Oracle/' + TABLE + '/Reader.nextRows/select',
              setName: 'Datastore/statement/Oracle/' + TABLE +   '/Connection.execute/insert',
              callCount: 6,
              insertCallCount: 5
            })
          })
        })
      }
    })
  })
}

function preparedTest(t) {
  t.notOk(agent.getTransaction(), 'no transaction should be in play')
  helper.runInTransaction(agent, function transactionInScope(tx) {
    var transaction = agent.getTransaction()

    t.ok(transaction, 'transaction should be visible')
    t.equal(tx, transaction, 'We got the same transaction')

    var colVal = 'Hello'
    var pkVal = 511
    var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' + COL
    insQuery += ') VALUES (:1, :2)'

    var client = oracle.connectSync(connectData)
    var statement = client.prepare(insQuery)

    statement.execute([pkVal, colVal], function (error, ok) {
      if (error) return t.fail(error)
      t.ok(agent.getTransaction(), 'transaction should still be visible')
      t.ok(ok, 'everything should be peachy after setting')

      var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
      selQuery += PK + '=' + pkVal

      client.execute(selQuery, [], function (err, value) {
        if (err) return t.fail(err)
        t.ok(agent.getTransaction(), 'transaction should still still be visible')
        t.equals(value[0][COL], colVal, 'Oracle client should still work')
        transaction.end(function () {
          client.close()
          var callCount = 2
          var insertCallCount = 1
          var selectCallCount = 1
          t.equal(Object.keys(transaction.metrics.scoped).length, 0, 'should not have any scoped metrics')

          var unscoped = transaction.metrics.unscoped

          var expected = {
            'Datastore/all': callCount,
            'Datastore/allOther': callCount,
            'Datastore/operation/Oracle/insert': insertCallCount,
            'Datastore/operation/Oracle/select': selectCallCount
          }

          expected['Datastore/statement/Oracle/' + TABLE + '/insert'] = insertCallCount
          expected['Datastore/statement/Oracle/' + TABLE + '/select'] = selectCallCount

          var expectedNames = Object.keys(expected)
          var unscopedNames = Object.keys(unscoped)

          expectedNames.forEach(function (name) {
            t.ok(unscoped[name], 'should have unscoped metric ' + name)
            if (unscoped[name]) {
              t.equals(unscoped[name].callCount, expected[name], 'metric ' + name + ' should have correct callCount')
            }
          })

          t.equals(unscopedNames.length, expectedNames.length, 'should have correct number of unscoped metrics')

          var trace = transaction.getTrace()
          t.ok(trace, 'trace should exist')
          t.ok(trace.root, 'root element should exist')
          t.equals(
            trace.root.children.length,
            1,
            'there should be two child roots for this test'
          )

          var setSegment = trace.root.children[0]

          // todo: figure out how to register host and port
          //t.equals(setSegment.host, params.oracle_host, 'should register the host')
          //t.equals(setSegment.port, params.oracle_port, 'should register the port')

          t.ok(setSegment, 'trace segment for insert should exist')
          t.equals(
            setSegment.name,
            'Datastore/statement/Oracle/' + TABLE + '/Statement.execute/insert',
            'should register the query call'
          )
          t.equals(
            setSegment.children.length,
            1,
            'set should have 1 children for this test'
          )

          var getSegment = setSegment.children[0]

          t.ok(getSegment, 'trace segment for select should exist')

          if (!getSegment) return t.end()

          t.equals(
            getSegment.name,
            'Datastore/statement/Oracle/' + TABLE + '/Connection.execute/select',
            'should register the query call'
          )
          t.equals(
            getSegment.children.length,
            0,
            'get should leave us here at the end'
          )
          t.ok(getSegment._isEnded(), 'trace segment should have ended')+
          t.end()
        })
      })
    })
  })
}
