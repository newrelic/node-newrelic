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
  {packagePath : path.join(__dirname, 'commands', 'shutdown'),
   logger      : logger}
];
