'use strict'

var tap = require('tap')
    , params = require('../../lib/params')
    , helper = require('../../lib/agent_helper')
    , test = tap.test
    , connectData = {
        hostname: params.oracle_host,
        port: params.oracle_port,
        database: params.oracle_db,
        user: params.oracle_user,
        password: params.oracle_pass
    }
    , agent = helper.instrumentMockedAgent()
    , oracle = require('oracle')


//constants for table creation and db connection
var TABLE = 'testTable'
    , PK = 'PK_COLUMN'
    , COL = 'TEST_COLUMN'

/**
 * Deletion of testing table if already exists,
 * then recreation of a testing table
 *
 * @param Callback function to set off running the tests
 */
function oracleSetup(runTest) {

    oracle.connect(connectData, function (error, client) {
        if (error) {
            throw error
        }
        // todo: figure out how to do this in oracle, if exists doesn't work
        var tableDrop = 'DROP TABLE ' + TABLE

        var tableCreate = 'CREATE TABLE ' + TABLE + ' (' + PK + ' NUMBER PRIMARY KEY, '
        tableCreate += COL + ' VARCHAR2(50))'

        client.execute(tableDrop, [], function (error) {
            if (error) {
                // i don't really care if tableDrop fails, as long as we can create the table we are okay
                console.log('there was an error dropping the test table', error)
            }

            client.execute(tableCreate, [], function (err, result) {
                if (err) {
                    throw err
                }
                client.close()
                runTest()
            })
        })
    })
}

/**
 *
 * @param t - test object
 * @param transaction - new relic transaction
 */
function verify(t, transaction) {
    setImmediate(function () {

        t.equal(Object.keys(transaction.metrics.scoped).length, 0, 'should not have any scoped metrics')

        var unscoped = transaction.metrics.unscoped

        var expected = {
            'Datastore/all': 2,
            'Datastore/allOther': 2,
            'Datastore/operation/Oracle/insert': 1,
            'Datastore/operation/Oracle/select': 1
        }

        expected['Datastore/statement/Oracle/' + TABLE + '/insert'] = 1
        expected['Datastore/statement/Oracle/' + TABLE + '/select'] = 1

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

        t.equals(trace.root.children.length, 1,
            'there should be only one child of the root')
        var setSegment = trace.root.children[0]

        t.ok(setSegment, 'trace segment for insert should exist')
        t.equals(setSegment.name, 'Datastore/statement/Oracle/' + TABLE + '/insert',
            'should register the query call')
        t.equals(setSegment.children.length, 1,
            'set should have an only child')
        var getSegment = setSegment.children[0]
        t.ok(getSegment, 'trace segment for select should exist')

        if (!getSegment) return t.end()

        t.equals(getSegment.name, 'Datastore/statement/Oracle/' + TABLE + '/select',
            'should register the query call')
        t.equals(getSegment.children.length, 0,
            'get should leave us here at the end')
        t.ok(getSegment._isEnded(), 'trace segment should have ended')

        t.end()
    })
}

test('Oracle instrumentation', function (t) {
    t.plan(2)

    oracleSetup(runTest)
    function runTest() {


        t.test('simple query with prepared statement and connectSync', function (t) {
            t.notOk(agent.getTransaction(), 'no transaction should be in play')
            helper.runInTransaction(agent, function transactionInScope(tx) {
                var transaction = agent.getTransaction()

                t.ok(transaction, 'transaction should be visible')
                t.equal(tx, transaction, 'We got the same transaction')

                var colVal = 'Hello'
                var pkVal = 112
                var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' + COL
                insQuery += ') VALUES (:1, :2)'

                var client = oracle.connectSync(connectData)

                client.execute(insQuery, [pkVal, colVal], function (error, ok) {
                    if (error) return t.fail(error)
                    t.ok(agent.getTransaction(), 'transaction should still be visible')
                    t.ok(ok, 'everything should be peachy after setting')

                    var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
                    selQuery += PK + '=' + pkVal

                    client.execute(selQuery, [], function (error, value) {
                        if (error) return t.fail(error)
                        t.ok(agent.getTransaction(), 'transaction should still still be visible')
                        t.equals(value[0][COL], colVal, 'Oracle client should still work')

                        transaction.end(function () {
                            client.close()
                            verify(t, transaction)
                        })
                    })
                })
            })


        })

        t.test('simple query with prepared statement and connect', function (t) {

            t.notOk(agent.getTransaction(), 'no transaction should be in play')
            helper.runInTransaction(agent, function transactionInScope(tx) {
                var transaction = agent.getTransaction()
                t.ok(transaction, 'transaction should be visible')
                t.equal(tx, transaction, 'We got the same transaction')

                var colVal = 'Hello'
                var pkVal = 111
                var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' + COL
                insQuery += ') VALUES(:1, :2)'

                oracle.connect(connectData, function (err, client) {

                    if (err) return t.fail(error)
                    client.execute(insQuery, [pkVal, colVal], function (error, ok) {
                        if (error) return t.fail(error)
                        t.ok(agent.getTransaction(), 'transaction should still be visible')
                        t.ok(ok, 'everything should be peachy after setting')

                        var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
                        selQuery += PK + '=' + pkVal

                        client.execute(selQuery, [], function (error, value) {
                            if (error) return t.fail(error)
                            t.ok(agent.getTransaction(), 'transaction should still still be visible')
                            t.equals(value[0][COL], colVal, 'Oracle client should still work')

                            transaction.end(function () {
                                client.close()
                                verify(t, transaction)
                            })
                        })
                    })
                })
            })


        })

        t.tearDown(function () {
            helper.unloadAgent(agent)
        })
    }
})
