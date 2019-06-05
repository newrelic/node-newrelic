'use strict'

var tap = require('tap')
var test = tap.test

var params = require('../../lib/params')
var helper = require('../../lib/agent_helper')
var findSegment = require('../../lib/metrics_helper').findSegment
var agent = helper.instrumentMockedAgent()

var tedious = require('tedious')
var Connection = tedious.Connection
var Request = tedious.Request
var TediousTypes = tedious.TYPES

var setupSql = `
  DROP TABLE IF EXISTS dbo.TestTable;
  CREATE TABLE TestTable
  (
    id   INTEGER       NOT NULL IDENTITY(1,1) PRIMARY KEY,
    test NVARCHAR(100) NOT NULL
  );
  INSERT INTO TestTable(test)
  VALUES ('foo');
`

function verifyMetrics(t, actualMetrics, expected) {
  var actualUnscoped = actualMetrics.unscoped

  Object.keys(expected).forEach(function(metricName) {
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

function verifySegments(t, transaction, expectedSegments) {
  var trace = transaction.trace

  t.ok(trace, 'trace should exist')
  t.ok(trace.root, 'trace root should exist')
  t.equal(trace.root.children.length, 1, 'a segment should exist')

  var segment = trace.root

  for (var i = 0; i < expectedSegments.length; i++) {
    var expectedSegmentName = expectedSegments[i]

    segment = findSegment(segment, expectedSegmentName)

    t.ok(segment, "should have called segment called " + expectedSegmentName)
  }
}

test('tedious instrumentation', function(t) {
  var tediousConnection

  t.test('before all', function(t) {
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
        database: params.mssql_db,
        port: params.mssql_port,
        rowCollectionOnRequestCompletion: true
      }
    })

    tediousConnection.on('connect', function(error) {
      if (error) {
        throw error
      }

      tediousConnection.execSql(new Request(setupSql, function(error) {
        if (error) {
          throw error
        }

        t.end()
      }))
    })
  })

  t.test('select', function(t) {
    t.notOk(agent.getTransaction(), 'there should be no current transaction')

    helper.runInTransaction(agent, function transactionInScope(transaction) {
      var sql = 'SELECT TOP 1 * FROM TestTable'

      tediousConnection.execSql(new Request(sql, function(error, rowCount) {
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

        verifySegments(t, transaction, ['Datastore/statement/MSSQL/TestTable/select'])

        t.end()
      }))
    })
  })

  t.test('insert', function(t) {
    t.notOk(agent.getTransaction(), 'there should be no current transaction')

    helper.runInTransaction(agent, function transactionInScope(transaction) {
      var sql = "INSERT INTO TestTable(test) VALUES('bar')"
      tediousConnection.execSql(new Request(sql, function(error, rowCount) {
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

        verifySegments(t, transaction, ['Datastore/statement/MSSQL/TestTable/insert'])

        t.end()
      }))
    })
  })

  t.test('update', function(t) {
    t.notOk(agent.getTransaction(), 'there should be no current transaction')

    var selectSql = 'SELECT TOP 1 * FROM TestTable'
    var updateSql = "UPDATE TestTable SET test = 'foo' WHERE id = @id"

    tediousConnection.execSql(new Request(selectSql, function(error, _, rows) {
      if (error) {
        return t.fail(error)
      }

      var id = rows[0].find(function(row) {
        return row.metadata.colName === 'id'
      }).value

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        var request = new Request(updateSql, function(error) {
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

          verifySegments(t, transaction, ['Datastore/statement/MSSQL/TestTable/update'])

          t.end()
        })

        request.addParameter('id', tedious.TYPES.Int, id)

        tediousConnection.execSql(request)
      })
    }))
  })

  t.test('delete', function(t) {
    t.notOk(agent.getTransaction(), 'there should be no current transaction')

    var selectSql = 'SELECT TOP 1 * FROM TestTable'
    var deleteSql = "DELETE FROM TestTable WHERE id = @id"

    tediousConnection.execSql(new Request(selectSql, function(error, _, rows) {
      if (error) {
        return t.fail(error)
      }

      var id = rows[0].find(function(row) {
        return row.metadata.colName === 'id'
      }).value

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        var request = new Request(deleteSql, function(error) {
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
            'Datastore/operation/MSSQL/delete': 1,
            'Datastore/statement/MSSQL/TestTable/delete': 1
          })

          verifySegments(t, transaction, ['Datastore/statement/MSSQL/TestTable/delete'])

          t.end()
        })

        request.addParameter('id', tedious.TYPES.Int, id)

        tediousConnection.execSql(request)
      })
    }))
  })

  t.test('stored procedure', function(t) {
    var dropProcSql = "DROP PROCEDURE IF EXISTS test_stp;"
    var procSql = `
      CREATE PROCEDURE test_stp
        @text nvarchar(50)
    AS
      SET NOCOUNT ON;

      INSERT INTO TestTable(test)
      VALUES (@text);

      SELECT SCOPE_IDENTITY();`
    t.notOk(agent.getTransaction(), 'there should be no current transaction')

    tediousConnection.execSql(new Request(dropProcSql, function(error) {
      if (error) {
        return t.fail(error)
      }

      tediousConnection.execSql(new Request(procSql, function(error) {
        if (error) {
          return t.fail(error)
        }

        helper.runInTransaction(agent, function transactionInScope(transaction) {
          var request = new Request('test_stp', function(error) {
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
              'Datastore/statement/MSSQL/test_stp/ExecuteProcedure': 1
            })

            verifySegments(
              t,
              transaction,
              ['Datastore/statement/MSSQL/test_stp/ExecuteProcedure'])

            t.end()
          })

          request.addParameter('text', TediousTypes.NVarChar, 'foobar')

          tediousConnection.callProcedure(request)
        })
      }))
    }))
  })

  t.test("successful transaction", function(t) {
    t.notOk(agent.getTransaction(), 'there should be no current transaction')

    helper.runInTransaction(agent, function transactionInScope(transaction) {
      tediousConnection.transaction(function userSuppliedCallback(error, endTransaction) {
        if (error) {
          endTransaction()
          return t.fail(error)
        }

        var agentTx = agent.getTransaction()
        t.ok(agentTx, 'transaction should be visible')
        t.equal(transaction, agentTx, 'current transaction should match initial')

        endTransaction(null, function() {
          transaction.end()

          verifyMetrics(t, transaction.metrics, {
            'Datastore/all': 2,
            'Datastore/allWeb': 2,
            'Datastore/MSSQL/all': 2,
            'Datastore/MSSQL/allWeb': 2,
            'Datastore/operation/MSSQL/beginTransaction': 1,
            'Datastore/operation/MSSQL/commitTransaction': 1
          })

          verifySegments(
            t,
            transaction,
            [
              'Datastore/operation/MSSQL/beginTransaction',
              'Datastore/operation/MSSQL/commitTransaction'
            ])

          t.end()
        })
      })
    })
  })

  t.test("nested transaction", function(t) {
    t.notOk(agent.getTransaction(), 'there should be no current transaction')
    helper.runInTransaction(agent, function transactionInScope(transaction) {
      tediousConnection.transaction(function userSuppliedCallback(error, endTransaction) {
        if (error) {
          endTransaction()
          return t.fail(error)
        }

        tediousConnection.transaction(function nested(error) {
          if (error) {
            endTransaction()

            return t.fail(error)
          }
          var agentTx = agent.getTransaction()
          t.ok(agentTx, 'transaction should be visible')
          t.equal(transaction, agentTx, 'current transaction should match initial')

          endTransaction(null, function() {
            transaction.end()

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 3,
              'Datastore/allWeb': 3,
              'Datastore/MSSQL/all': 3,
              'Datastore/MSSQL/allWeb': 3,
              'Datastore/operation/MSSQL/beginTransaction': 1,
              'Datastore/operation/MSSQL/saveTransaction': 1,
              'Datastore/operation/MSSQL/commitTransaction': 1
            })

            verifySegments(
              t,
              transaction,
              [
                'Datastore/operation/MSSQL/beginTransaction',
                'Datastore/operation/MSSQL/saveTransaction',
                'Datastore/operation/MSSQL/commitTransaction'
              ])

            t.end()
          })
        })
      })
    })
  })

  t.test("transaction rollback", function(t) {
    t.end()
  })

  t.test('teardown', function(t) {
    helper.unloadAgent(agent)
    if (tediousConnection && !tediousConnection.closed) {
      tediousConnection.close()
    }
    t.end()
  })

  t.end()
})
