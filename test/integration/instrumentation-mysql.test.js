'use strict';

var path = require('path')
  , mysql = require('mysql')
  , shimmer = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  , helper = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

describe("MySQL instrumentation", function () {
  var agent
    , architecture
    ;

  function bootstrapTestDB(done) {
    return function (error, app) {
      if (error) return done(error);
      architecture = app;

      var TEST_DB    = 'agent_integration';
      var TEST_TABLE = 'test';
      var TEST_USER  = 'tester';

      var client = mysql.createClient({
        user : 'root'
      });

      client.query("GRANT ALL ON " + TEST_DB + ".* TO ''@'localhost'", function (error, results) {
        if (error) return helper.cleanMySQL(architecture, function () { return done(error); });

        client.query("CREATE DATABASE IF NOT EXISTS " + TEST_DB, function (error) {
          if (error) return helper.cleanMySQL(architecture, function () { return done(error); });

          client.useDatabase(TEST_DB);
          client.query("CREATE TABLE IF NOT EXISTS " + TEST_TABLE +
                       "(" +
                       "  id         INTEGER(10) PRIMARY KEY AUTO_INCREMENT," +
                       "  test_value VARCHAR(255)" +
                       ")", function (error) {
            if (error) return helper.cleanMySQL(architecture, function () { return done(error); });

            return done();
          });
        });
      });
    };
  }

  before(function (done) {
    this.timeout(20 * 1000);
    agent = helper.loadMockedAgent();
    shimmer.bootstrapInstrumentation(agent);

    helper.withMySQL(bootstrapTestDB(done));
  });

  after(function (done) {
    helper.unloadAgent(agent);
    helper.cleanMySQL(architecture, done);
  });

  it("should find the MySQL call in the transaction trace");
});
