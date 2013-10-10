'use strict';

var path   = require('path')
  , test   = require('tap').test
  , logger = require(path.join(__dirname, '..', '..', '..', 'lib', 'logger'))
  , helper = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper'))
  ;

var DBUSER = 'test_user'
  , DBNAME = 'agent_integration'
  , DBTABLE = 'test'
  ;

test("MySQL instrumentation with a connection pool and node-mysql 2.0+",
     {timeout : 30 * 1000},
     function (t) {
  t.plan(9);

  helper.bootstrapMySQL(function (error, app) {
    // set up the instrumentation before loading MySQL
    var agent = helper.instrumentMockedAgent();
    var mysql   = require('mysql')
      , generic = require('generic-pool')
      ;

    /*
     *
     * SETUP
     *
     */
    var poolLogger = logger.child({component : 'pool'});
    var pool = generic.Pool({
      name              : 'mysql',
      min               : 2,
      max               : 6,
      idleTimeoutMillis : 250,

      log : function (message) { poolLogger.info(message); },

      create : function (callback) {
        var client = mysql.createConnection({
          user     : DBUSER,
          database : DBNAME
        });

        client.on('error', function (err) {
          poolLogger.error("MySQL connection errored out, destroying connection");
          poolLogger.error(err);
          pool.destroy(client);
        });

        client.connect(function (err) {
          if (err) {
            poolLogger.error("MySQL client failed to connect. Does database %s exist?",
                             DBNAME);
          }

          callback(err, client);
        });
      },

      destroy : function (client) {
        poolLogger.info("Destroying MySQL connection");
        client.end();
      }
    });

    var withRetry = {
      getClient : function (callback, counter) {
        if (!counter) counter = 1;
        counter++;

        pool.acquire(function (err, client) {
          if (err) {
            poolLogger.error("Failed to get connection from the pool: %s", err);

            if (counter < 10) {
              pool.destroy(client);
              withRetry.getClient(callback, counter);
            }
            else {
              return callback(new Error("Couldn't connect to DB after 10 attempts."));
            }
          }
          else {
            callback(null, client);
          }
        });
      },

      release : function (client) {
        pool.release(client);
      }
    };

    var dal = {
      lookup : function (params, callback) {
        if (!params.id) return callback(new Error("Must include ID to look up."));

        withRetry.getClient(function (err, client) {
          if (err) return callback(err);

          client.query("SELECT *" +
                       "  FROM " + DBNAME + '.' + DBTABLE +
                       " WHERE id = ?",
                       [params.id],
                       function (err, results) {
            withRetry.release(client); // always release back to the pool

            if (err) return callback(err);

            callback(null, results.length ? results[0] : results);
          });
        });
      }
    };

    if (error) {
      t.fail(error);
      return t.end();
    }

    this.tearDown(function () {
      pool.drain(function() {
        pool.destroyAllNow();
        helper.cleanMySQL(app, function done() {
          helper.unloadAgent(agent);
        });
      });
    });

    /*
     *
     * TEST GOES HERE
     *
     */
    t.notOk(agent.getTransaction(), "no transaction should be in play yet");
    helper.runInTransaction(agent, function transactionInScope() {
      dal.lookup({id : 1}, function (error, row) {
        if (error) {
          t.fail(error);
          return t.end();
        }

        var transaction = agent.getTransaction();
        if (!transaction) {
          t.fail("transaction should be visible");
          return t.end();
        }

        t.equals(row.id, 1, "node-mysql should still work (found id)");
        t.equals(row.test_value, 'hamburgefontstiv',
                 "mysql driver should still work (found value)");

        transaction.end();

        var trace = transaction.getTrace();
        t.ok(trace, "trace should exist");
        t.ok(trace.root, "root element should exist.");
        t.equals(trace.root.children.length, 1, "There should be only one child.");

        var selectSegment = trace.root.children[0];
        t.ok(selectSegment, "trace segment for first SELECT should exist");
        t.equals(selectSegment.name,
                 "Datastore/statement/MySQL/agent_integration.test/select",
                 "should register as SELECT");
        t.equals(selectSegment.children.length, 0, "SELECT should have no children");

        t.end();
      });
    });
  }.bind(this));
});
