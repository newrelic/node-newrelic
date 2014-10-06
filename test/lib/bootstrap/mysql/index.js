'use strict'

var mysql = require('mysql')
  , Q     = require('q')
  , params = require('../../params')
  

/**
 * There isn't actually an exported API, as all the action is in the setup
 * itself.
 */
module.exports = function setup(options, imports, register) {
  var logger    = options.logger
    , username  = options.db.user
    , dbname    = options.db.name
    , tablename = options.db.table
    

  function run(client, commands) {
    return commands.reduce(
      function (last, next) { return last.then(next); },
      Q.resolve(client)
    )
  }

  function query(client, sql, successMessage) {
    return Q.ninvoke(client, 'query', sql).then(function cb_then() {
      logger.debug(successMessage)

      return client
    })
  }

  function end(client) {
    return Q.ninvoke(client, 'end').then(function cb_then() {
      logger.debug("Connection as %s destroyed.", client.user)
    })
  }

  function createUser(client) {
    return query(
      client,
      "CREATE USER '" + username + "'",
      "User '" + username + "' created successfully."
    )
  }

  function grantPermissions(client) {
    return query(
      client,
      "GRANT ALL ON " + dbname + ".* TO '" + username + "'",
      "Access granted to user '" + username + "'."
    )
  }

  function createDB(client) {
    return query(
      client,
      "CREATE DATABASE IF NOT EXISTS " + dbname,
      "Database '" + dbname + "' created."
    )
  }

  function connectAsTestUser() {
    logger.debug("Reconnecting as %s.", username)

    return Q.resolve(mysql.createClient({
      user     : username,
      database : dbname,
      host     : params.mysql_host,
      port     : params.mysql_port
    }))
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
    )
  }

  function truncateTable(client) {
    return query(
      client,
      'TRUNCATE TABLE ' + tablename,
      "Table '" + tablename + "' truncated.'"
    )
  }

  function createSeedData(client) {
    return query(
      client,
      "INSERT INTO " + tablename + " (test_value) VALUE (\"hamburgefontstiv\")",
      "Test data seeded into table '" + tablename + "'."
    )
  }

  function ensureTable(client) {
    var sql = "SELECT table_name " +
              "  FROM information_schema.tables " +
              " WHERE table_schema = ? " +
              "   AND table_name = ?"

    /* A weird side effect of Q.ninvoke: more than just one non-error
     * parameter expected on the callback, get back an array of all of
     * them. Q.get(0) will grab the first parameter.
     */
    return Q.ninvoke(client, 'query', sql, [dbname, tablename])
      .get(0)
      .get('length')
      .then(function cb_then(length) {
        logger.debug("%s test table(s) found.", length)
        if (length > 0) return client

        throw new Error("Test table missing. Test database not initialized.")
      })
  }

  function ensureData(client) {
    var sql = "SELECT COUNT(*) AS counted " +
              "  FROM " + dbname + "." + tablename

    return Q.ninvoke(client, 'query', sql)
      .get(0)
      .then(function cb_then(result) {
        if (result.length !== 1) throw new Error("Test table query failed.")

        var count = result[0].counted
        logger.debug("%s test data row(s).", count)
        if (count > 0) return client

        throw new Error("No test data seeded. Only partially initialized.")
      })
  }

  function succeeded() {
    logger.info("Test database initialized.")
    return register(null, {mysqlBootstrap : {}})
  }

  function failed(error) {
    return register(error)
  }

  var client = mysql.createClient({
    user     : 'root',
    database : 'mysql',
    host     : params.mysql_host,
    port     : params.mysql_port
  })

  // actually run the initializer
  var isInitialized = run(client, [ensureTable, end, connectAsTestUser, truncateTable, createSeedData, ensureData, end])
  isInitialized.then(
    succeeded,
    function notYetBootstrapped(error) {
      logger.debug(error.message)

      // reuse the first connection because why not
      var bootstrap = run(client,
        [
          createUser, grantPermissions, createDB, end,
          connectAsTestUser,
          createTestTable, createSeedData,
          ensureTable, ensureData, end
        ]
      )
      bootstrap.then(succeeded, failed).done()
    }
  )
}
