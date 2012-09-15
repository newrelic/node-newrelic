'use strict';

module.exports = function setup(options, imports, register) {
  var logger  = options.logger
    , mongodb = imports.mongodb
    ;

  process.on('SIGINT', function () {
    console.error("Got SIGINT. Shutting down.");
    mongodb.shutdown();
    process.exit(0);
  });

  return register();
};
