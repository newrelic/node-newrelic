'use strict';

var path   = require('path')
  , tap    = require('tap')
  , params = require('../lib/params')
  , test   = tap.test
  , helper = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

//FLAG: postgres
var agent  = helper.instrumentMockedAgent({postgres: true})
  , pg     = require('pg')
  ;

//constants for table creation and db connection
var TABLE      = 'testTable'
  , PK         = 'pk_column'
  , COL        = 'test_column'
  , CON_STRING = 'postgres://' + params.postgres_user + ':' + params.postgres_pass + '@'
      + params.postgres_host + ':' + params.postgres_port + '/' + params.postgres_db;


/**
 * Deletion of testing table if already exists,
 * then recreation of a testing table
 *
 *
 * @param Callback function to set off running the tests
 */
function postgresSetup (runTest) {
  var setupClient = new pg.Client(CON_STRING);

  setupClient.connect(function (error) {
    if (error) {
      throw error;
    }
    var tableDrop = 'DROP TABLE IF EXISTS ' + TABLE;

    var tableCreate = 'CREATE TABLE ' + TABLE + ' (' + PK + ' integer PRIMARY KEY, ';
    tableCreate += COL + ' text);';

    setupClient.query(tableDrop, function (error) {
      if (error) {
        throw error;
      }
      setupClient.query(tableCreate, function (error) {
        if (error) {
          throw error;
        }
        setupClient.end();
        runTest();
      });
    });
  });
 };


test("Postgres instrumentation", {timeout : 5000}, function (t) {
  t.plan(2);
  postgresSetup(runTest);
  function runTest () {

    t.test("simple query with prepared statement", function (t) {

      var client = new pg.Client(CON_STRING);

      t.notOk(agent.getTransaction(), "no transaction should be in play");
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction();
        t.ok(transaction, "transaction should be visible");
        t.equal(tx, transaction, 'We got the same transaction');

        var colVal = 'Hello';
        var pkVal= 111;
        var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' +  COL;
        insQuery += ') VALUES($1, $2);';

        client.connect(function (error) {
          if (error) return t.fail(error);
          client.query(insQuery, [pkVal, colVal], function (error, ok) {
             if (error) return t.fail(error);

            t.ok(agent.getTransaction(), "transaction should still be visible");
            t.ok(ok, "everything should be peachy after setting");

            var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE ';
            selQuery += PK + "=" + pkVal + ";";

            client.query(selQuery, function (error, value) {
              if (error) return t.fail(error);
              t.ok(agent.getTransaction(), "transaction should still still be visible");
              t.equals(value.rows[0][COL], colVal, "Postgres client should still work");

              transaction.end();

              var trace = transaction.getTrace();
              t.ok(trace, "trace should exist");
              t.ok(trace.root, "root element should exist");
              t.equals(trace.root.children.length, 1,
                     "there should be only one child of the root");
              var setSegment = trace.root.children[0];
              t.ok(setSegment, "trace segment for set should exist");
              t.equals(setSegment.name, "Datastore/operation/Postgres/query",
                     "should register the query call");
              t.equals(setSegment.children.length, 1,
                     "set should have an only child");
              var getSegment = setSegment.children[0];
              t.ok(getSegment, "trace segment for get should exist");
              t.equals(getSegment.name, "Datastore/operation/Postgres/query",
                     "should register the query call");
              t.equals(getSegment.children.length, 0,
                     "get should leave us here at the end");
              client.end();
              t.end();
            });
          });
        });
      });
    });


    t.test("client pooling query", function (t) {
      t.notOk(agent.getTransaction(), "no transaction should be in play");
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction();
        t.ok(transaction, "transaction should be visible");
        t.equal(tx, transaction, 'We got the same transaction');

        var colVal = 'World!';
        var pkVal= 222;
        var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' +  COL;
        insQuery += ') VALUES(' + pkVal + ",'" + colVal + "');" ;


        pg.connect(CON_STRING, function(error, clientPool, done) {
          if (error) return t.fail (error);
          clientPool.query(insQuery, function (error, ok) {
            if (error) return t.fail(error);
            t.ok(agent.getTransaction(), "transaction should still be visible");
            t.ok(ok, "everything should be peachy after setting");

            var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE ';
            selQuery += PK + "=" + pkVal + ";";

            clientPool.query(selQuery, function (error, value) {
              if (error) return t.fail(error);

              t.ok(agent.getTransaction(), "transaction should still still be visible");
              t.equals(value.rows[0][COL], colVal, "Postgres client should still work");

              transaction.end();

              var trace = transaction.getTrace();
              t.ok(trace, "trace should exist");
              t.ok(trace.root, "root element should exist");
              t.equals(trace.root.children.length, 1,
                     "there should be only one child of the root");
              var setSegment = trace.root.children[0];
              t.ok(setSegment, "trace segment for set should exist");
              t.equals(setSegment.name, "Datastore/operation/Postgres/query",
                     "should register the query call");
              t.equals(setSegment.children.length, 1,
                     "set should have an only child");
              var getSegment = setSegment.children[0];
              t.ok(getSegment, "trace segment for get should exist");
              t.equals(getSegment.name, "Datastore/operation/Postgres/query",
                     "should register the query call");
              t.equals(getSegment.children.length, 0,
                     "get should leave us here at the end");

              t.end();
              done();
            });
          });
        });
      });
    });

    t.tearDown(function () {
      pg.end();
      helper.unloadAgent(agent);
    });
  };
});

