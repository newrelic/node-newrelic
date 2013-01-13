'use strict';

var mysql = require('mysql')
  , Q     = require('q')
  ;

/**
 * There isn't actually an exported API, as all the action is in the setup
 * itself.
 */
module.exports = function setup(options, imports, register) {
  var logger    = options.logger
    , username  = options.db.user
    , dbname    = options.db.name
    , tablename = options.db.table
    ;

  function query(client, sql, successMessage) {
    return Q.ninvoke(client, 'query', sql).then(function () {
      logger.debug(successMessage);

      return client;
    });
  }

  function end(client) {
    return Q.ninvoke(client, 'end').then(function () {
      logger.debug("Connection as %s destroyed.", client.user);
    });
  }

  function createUser(client) {
    return query(
      client,
      "CREATE USER '" + username + "'@'localhost'",
      "User '" + username + "' created successfully."
    );
  }

  function grantPermissions(client) {
    return query(
      client,
      "GRANT ALL ON " + dbname + ".* TO '" + username + "'@'localhost'",
      "Access granted to user '" + username + "'."
    );
  }

  function createDB(client) {
    return query(
      client,
      "CREATE DATABASE IF NOT EXISTS " + dbname,
      "Database '" + dbname + "' created."
    );
  }

  function reconnectAsUser(client) {
    return end(client).then(function () {
      logger.debug("Reconnecting as %s.", username);

      return mysql.createClient({
        user     : username,
        database : dbname
      });
    });
  }

  function createTestTable(client) {
    return query(
      client,
      "CREATE TABLE IF NOT EXISTS " + tablename +
        "(" +
        "  id         INTEGER(10) PRIMARY KEY AUTO_INCREMENT," +
        "  test_value VARCHAR(255)" +
        ")",
      "Table '" + tablename + "' created."
    );
  }

  function createSeedData(client) {
    return query(
      client,
      "INSERT INTO " + tablename + " (test_value) VALUE (\"hamburgefontstiv\")",
      "Test data seeded into table '" + tablename + "'."
    );
  }

  function ensureTable(client) {
    var sql = "SELECT table_name " +
              "  FROM information_schema.tables " +
              " WHERE table_schema = ? " +
              "   AND table_name = ?";

    return Q.ninvoke(client, 'query', sql, [dbname, tablename])
      .then(function (args) {
        /* A weird side effect of Q.ninvoke: more than just one non-error
         * parameter expected on the callback, get back an array of all of
         * them.
         */
        var result = args[0];
        logger.debug("Tables matching SQL [%s]: %s", sql, result.length);
        if (result.length > 0) return client;

        throw new Error("Test table missing. Not bootstrapped.");
      });
  }

  function ensureData(client) {
    var sql = "SELECT COUNT(*) AS counted " +
              "  FROM " + dbname + "." + tablename;

    return Q.ninvoke(client, 'query', sql)
      .then(function (args) {
        var result = args[0];

        if (result.length !== 1) throw new Error("Test table query failed.");

        logger.debug("Test data rows: %s", result[0].counted);
        if (result[0].counted > 0) return client;

        throw new Error("No test data seeded. Only partially bootstrapped.");
      });
  }

  function succeeded() {
    return register(null, {mysqlBootstrap : {}});
  }

  function failed(error) {
    return register(error);
  }

  function run() {
    var commands = Array.prototype.slice.call(arguments);
    return commands.reduce(
      function (last, next) { return last.then(next); },
      Q.resolve(mysql.createClient({
        user     : 'root',
        database : 'mysql'
      }))
    );
  }

  // make a verifier that can be reused once the bootstrap is complete
  var checker = run(ensureTable, ensureData, end);
  checker.then(
    succeeded,
    function notYetBootstrapped(error) {
      // will indicate which piece wasn't yet bootstrapped
      logger.debug(error.message);

      var bootstrap = run(
        // basic database setup
        createUser, grantPermissions, createDB,
        // drop permissions
        reconnectAsUser,
        // create stuff as user
        createTestTable, createSeedData
      );

      bootstrap.then(checker).then(succeeded, failed).done();
    }
  );
};
