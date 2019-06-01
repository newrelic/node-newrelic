'use strict'

var tap = require('tap')
var test = tap.test

var params = require('../../lib/params')
var helper = require('../../lib/agent_helper')
var agent = helper.instrumentMockedAgent()

var tedious = require('tedious')
var Connection = tedious.Connection
var Request = tedious.Request


var setupSql = `
IF NOT EXISTS (SELECT * FROM master.sys.databases WHERE name = N'${params.mssql_db}')
BEGIN
    CREATE DATABASE ${params.mssql_db}
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND  TABLE_NAME = 'TestTable') 
BEGIN
    CREATE TABLE TestTable (
        id INTEGER NOT NULL IDENTITY(1,1) PRIMARY KEY,
        test NVARCHAR(100) NOT NULL
    )
    
    INSERT INTO TestTable(test) VALUES('foo')
END`;

var tearDownSql = `
  DROP TABLE TestTable
`

function verifyMetrics(t, actualMetrics, expected) {
  var actualUnscoped = actualMetrics.unscoped

  Object.keys(expected).forEach(function (metricName) {
    var actual = actualUnscoped[metricName]

    t.ok(
      actual,
      `should have collected unscoped metric ${metricName}`
    )
    t.equals(
      actual.callCount,
      expected[metricName],
      `metric ${metricName} should have correct call count`
    )
  })
}

test('tedious instrumentation', function (t) {
  var tediousConnection
  // var agent
  //
  // t.beforeEach(function(done) {
  //   agent = helper.instrumentMockedAgent()
  //
  //   done()
  // })
  //
  // t.afterEach(function(done) {
  //   helper.unloadAgent(agent)
  //   done()
  // })

  t.test('before all', function (t) {
    tediousConnection = new Connection({
      server: params.mssql_host,
      authentication: {
        options: {
          userName: params.mssql_user,
          password: params.mssql_pass
        },
        type: 'default'
      },
      options: {
        port: params.mssql_port,
        rowCollectionOnRequestCompletion: true
      }
    })

    tediousConnection.on('connect', function (error) {
      if (error) {
        throw error
      }

      tediousConnection.execSql(new Request(setupSql, function (error) {
        if (error) {
          throw error
        }

        t.end()
      }))
    })
  })

  t.test('select', function (t) {
    t.notOk(agent.getTransaction(), 'there should be no current transaction')

    helper.runInTransaction(agent, function transactionInScope(transaction) {
      var sql = 'SELECT TOP 1 * FROM TestTable'

      tediousConnection.execSql(new Request(sql, function (error, rowCount) {
        if (error) {
          return t.fail(error)
        }

        var agentTx = agent.getTransaction()

        t.ok(agentTx, 'transaction should be visible')
        t.equal(transaction, agentTx, 'current transaction should match initial')
        t.equal(rowCount, 1, 'client should return 1 row')
        transaction.end()

        verifyMetrics(t, transaction.metrics, {
          'Datastore/all': 1,
          'Datastore/allWeb': 1,
          'Datastore/MSSQL/all': 1,
          'Datastore/MSSQL/allWeb': 1,
          'Datastore/operation/MSSQL/select': 1,
          'Datastore/statement/MSSQL/TestTable/select': 1
        })

        t.end()
      }))
    })
  })

  t.test('insert', function (t) {
    t.notOk(agent.getTransaction(), 'there should be no current transaction')

    helper.runInTransaction(agent, function transactionInScope(transaction) {
      var sql = "INSERT INTO TestTable(test) VALUES('bar')"
      tediousConnection.execSql(new Request(sql, function (error, rowCount) {
        if (error) {
          return t.fail(error)
        }

        var agentTx = agent.getTransaction()
        t.equal(rowCount, 1, 'should have affected 1 row')
        t.ok(agentTx, 'transaction should be visible')
        t.equal(transaction, agentTx, 'current transaction should match initial')

        transaction.end()

        verifyMetrics(t, transaction.metrics, {
          'Datastore/all': 1,
          'Datastore/allWeb': 1,
          'Datastore/MSSQL/all': 1,
          'Datastore/MSSQL/allWeb': 1,
          'Datastore/operation/MSSQL/insert': 1,
          'Datastore/statement/MSSQL/TestTable/insert': 1
        })

        t.end()
      }))
    })
  })

  t.test('update', function (t) {
    t.notOk(agent.getTransaction(), 'there should be no current transaction')

    var selectSql = 'SELECT TOP 1 * FROM TestTable'
    var updateSql = "UPDATE TestTable SET test = 'foo' WHERE id = @id"

    tediousConnection.execSql(new Request(selectSql, function (error, _, rows) {
      if (error) {
        return t.fail(error)
      }

      var id = rows[0].find(function (row) {
        return row.metadata.colName === 'id'
      }).value

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        var request = new Request(updateSql, function (error) {
          if (error) {
            return t.fail(error)
          }

          var agentTx = agent.getTransaction()
          t.ok(agentTx, 'transaction should be visible')
          t.equal(transaction, agentTx, 'current transaction should match initial')

          transaction.end()

          verifyMetrics(t, transaction.metrics, {
            'Datastore/all': 1,
            'Datastore/allWeb': 1,
            'Datastore/MSSQL/all': 1,
            'Datastore/MSSQL/allWeb': 1,
            'Datastore/operation/MSSQL/update': 1,
            'Datastore/statement/MSSQL/TestTable/update': 1
          })

          t.end()
        })

        request.addParameter('id', tedious.TYPES.Int, id)

        tediousConnection.execSql(request)
      })
    }))
  })
  //
  // t.test('delete', function(t) {
  //   t.end()
  // })
  //
  // t.test('stored procedure', function(t) {
  //   t.end()
  // })
  //
  // t.test('transaction', function(t) {
  //   t.end()
  // })

  // t.test('bulk insert', function(t) {
  //   t.end()
  // })

  // t.test('obfuscated', function(t) {
  //   t.end()
  // })

  //
  // t.test('cancel', function(t) {
  //   t.end()
  // })
  //
  // t.test('close', function(t) {
  //   t.end()
  // })
  //
  // t.test('reset', function(t) {
  //   t.end()
  // })

  t.test('teardown', function (t) {
    helper.unloadAgent(agent)
    if (tediousConnection && !tediousConnection.closed) {
      tediousConnection.execSql(new Request(tearDownSql, function (error) {
        if (error) {
          throw error
        }

        tediousConnection.close()

        t.end()
      }))
    } else {
      t.end()
    }
  })

  t.end()
})
