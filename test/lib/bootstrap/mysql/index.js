'use strict';

var mysql = require('mysql');

function withUser(options, next) {
  var user   = options.db.user
    , logger = options.logger
    ;

  return function (error, client) {
    if (error) return next(error);

    client.query("CREATE USER '" + user + "'@'localhost'", function (error) {
      if (error) return next(error);

      logger.debug("User '" + user + "' created successfully.");

      next(null, client);
    });
  };
}

function withDB(options, next) {
  var db     = options.db.name
    , user   = options.db.user
    , logger = options.logger
    ;

  return function (error, client) {
    if (error) return next(error);

    client.query("GRANT ALL ON " + db + ".* TO '" +
                 user + "'@'localhost'", function (error) {
      if (error) return next(error);

      logger.debug("Access granted to user '" + user + "'.");

      client.query("CREATE DATABASE IF NOT EXISTS " + db, function (error) {
        if (error) return next(error);

        logger.debug("Database '" + db + "' created.");

        client.end(function (error) {
          if (error) return next(error);

          logger.debug("Connection as root destroyed. Reconnecting as test user.");

          var lesserClient = mysql.createClient({
            user     : user,
            database : db
          });

          next(null, lesserClient);
        });
      });
    });
  };
}

function withTable(options, next) {
  var table  = options.db.table
    , logger = options.logger
    ;

  return function (error, client) {
    if (error) return next(error);

    client.query("CREATE TABLE IF NOT EXISTS " + table +
                 "(" +
                 "  id         INTEGER(10) PRIMARY KEY AUTO_INCREMENT," +
                 "  test_value VARCHAR(255)" +
                 ")", function (error) {
      if (error) return next(error);

      logger.debug("Table '" + table + "' created.");

      next(null, client);
    });
  };
}

function seedData(options, next) {
  var table  = options.db.table
    , logger = options.logger
    ;

  return function (error, client) {
    if (error) return next(error);

    client.query("INSERT INTO " + table +
                 " (test_value) VALUE (\"hamburgefontstiv\")", function (error) {
      if (error) return next(error);

      logger.debug("Test data seeded into table '" + table + "'.");

      next(null, client);
    });
  };
}

/**
 * There isn't actually an exported API, as all the action is in the setup
 * itself.
 */
module.exports = function setup(options, imports, register) {
  var client = mysql.createClient({
    user     : 'root',
    database : 'mysql'
  });

  var finish = function (error, client) {
    register(error, {mysqlBootstrap : {}});
  };

  /*
   * The power of functional programming: since each task is a generator taking
   * a uniform set of parameters and returning a callback with a uniform
   * interface, we can just apply a fold to get a composition of the set of
   * tasks and get something almost as concise as point-free style.
   */
  var tasks = [withUser, withDB, withTable, seedData, finish];
  var bootstrap = tasks.reverse().reduce(function (previous, current) {
    return current(options, previous);
  });
  bootstrap(null, client);
};
