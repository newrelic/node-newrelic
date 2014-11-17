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
    , async = require('async'),
    oracle

try {
    oracle = require('oracle')
} catch (error) {
    console.log('oracle driver not installed')
}

if (oracle) {

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
    var oracleSetup = function (runTest) {

        oracle.connect(connectData, function (error, client) {
            if (error) {
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
                    runTest()
                })
            })
        })
    }

    var getSelectSegment = function (setSegment, insertCallCount) {
        // loop through all of the insert segments to get to the select segment
        var getSegment = setSegment.children[0]
        for (var i = 1; i < insertCallCount; i++) {
            getSegment = getSegment.children[0]
        }
        return getSegment
    }

    /**
     *
     * @param t - test object
     * @param transaction - new relic transaction
     */
    var verify = function (t, transaction, callCount, insertCallCount, selectCallCount) {
        callCount = callCount || 2
        insertCallCount = insertCallCount || 1
        selectCallCount = selectCallCount || 1
        setImmediate(function () {

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
            t.equals(trace.root.children.length, 1,
                'there should be only one child of the root')
            var setSegment = trace.root.children[0]

            // todo: figure out how to register host and port
            //t.equals(setSegment.host, params.oracle_host, 'should register the host')
            //t.equals(setSegment.port, params.oracle_port, 'should register the port')

            t.ok(setSegment, 'trace segment for insert should exist')
            t.equals(setSegment.name, 'Datastore/statement/Oracle/' + TABLE + '/insert',
                'should register the query call')
            t.equals(setSegment.children.length, 1,
                'set should have an only child')

            var getSegment = getSelectSegment(setSegment, insertCallCount)

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
        t.plan(5)

        oracleSetup(runTest)
        function runTest() {

            t.test('simple query with connectSync', function (t) {
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

                    client.execute(insQuery, [pkVal, colVal], function (error, ok) {
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
                                verify(t, transaction)
                            })
                        })
                    })
                })
            })

            t.test('simple query with connect', function (t) {

                t.notOk(agent.getTransaction(), 'no transaction should be in play')
                helper.runInTransaction(agent, function transactionInScope(tx) {
                    var transaction = agent.getTransaction()
                    t.ok(transaction, 'transaction should be visible')
                    t.equal(tx, transaction, 'We got the same transaction')

                    var colVal = 'Hello'
                    var pkVal = 211
                    var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' + COL
                    insQuery += ') VALUES(:1, :2)'

                    oracle.connect(connectData, function (err, client) {

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
                                    verify(t, transaction)
                                })
                            })
                        })
                    })
                })


            })

            t.test('query using reader and nextRow', function (t) {

                function nextRowTest() {

                    t.notOk(agent.getTransaction(), 'no transaction should be in play')
                    helper.runInTransaction(agent, function transactionInScope(tx) {
                        var transaction = agent.getTransaction()
                        t.ok(transaction, 'transaction should be visible')
                        t.equal(tx, transaction, 'We got the same transaction')

                        var colVal = 'Hello'
                        var pkVal = 311
                        var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' + COL
                        insQuery += ') VALUES(:1, :2)'

                        oracle.connect(connectData, function (err, client) {

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
                                            verify(t, transaction, 2, 1)
                                        })
                                    })
                                })
                            })
                        })
                    })
                }

                oracleSetup(nextRowTest)
            })

            t.test('query using reader and nextRows', function (t) {

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

                        var insertCount = 0;

                        // insert 5 rows
                        async.whilst(
                            function () {
                                return insertCount < 5
                            },
                            function (callback) {
                                client.execute(insQuery, [pkVal, colVal], function (error, ok) {
                                    if (error) return t.fail(error)
                                    t.ok(agent.getTransaction(), 'transaction should still be visible')
                                    t.ok(ok, 'everything should be peachy after setting')
                                    insertCount++
                                    pkVal++
                                    callback()
                                })
                            },
                            testRead
                        )

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
                                    verify(t, transaction, 6, 5)
                                })
                            })
                        }
                    })
                })
            })

            t.test('simple query with prepared statement and connectSync', function (t) {

                function preparedStatement() {
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
                                    setImmediate(function () {

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
                                        t.equals(trace.root.children.length, 2,
                                            'there should be two child roots for this test')
                                        var setSegment = trace.root.children[0]

                                        // todo: figure out how to register host and port
                                        //t.equals(setSegment.host, params.oracle_host, 'should register the host')
                                        //t.equals(setSegment.port, params.oracle_port, 'should register the port')

                                        t.ok(setSegment, 'trace segment for insert should exist')
                                        t.equals(setSegment.name, 'Datastore/statement/Oracle/' + TABLE + '/insert',
                                            'should register the query call')
                                        t.equals(setSegment.children.length, 0,
                                            'set should have no children for this test')

                                        var getSegment = trace.root.children[1]

                                        t.ok(getSegment, 'trace segment for select should exist')

                                        if (!getSegment) return t.end()

                                        t.equals(getSegment.name, 'Datastore/statement/Oracle/' + TABLE + '/select',
                                            'should register the query call')
                                        t.equals(getSegment.children.length, 0,
                                            'get should leave us here at the end')
                                        t.ok(getSegment._isEnded(), 'trace segment should have ended')

                                        t.end()
                                    })
                                })
                            })
                        })
                    })
                }

                oracleSetup(preparedStatement)
            })

            t.tearDown(function () {
                helper.unloadAgent(agent)
            })
        }
    })
}