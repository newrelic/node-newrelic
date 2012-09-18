'use strict';

var path   = require('path')
  , logger = require(path.join(__dirname, 'logger'))
  ;

/**
 * This is a c9/architect configuration file.
 */
module.exports = [
  {packagePath : path.join(__dirname, 'services', 'mongodb'),
   dbpath      : path.join(__dirname, 'benchmarkr-mongodb'),
   logger      : logger.child({component : 'mongodb'})},
  {packagePath : path.join(__dirname, 'services', 'mysqld'),
   dbpath      : path.join(__dirname, 'benchmarkr-mysql'),
   logger      : logger.child({component : 'mysqld'})},
  {packagePath : path.join(__dirname, 'services', 'redis'),
   logger      : logger.child({component : 'redis'})},
  {packagePath : path.join(__dirname, 'services', 'memcached'),
   logger      : logger.child({component : 'memcached'})},
  {packagePath : path.join(__dirname, 'commands', 'shutdown'),
   logger      : logger}
];
