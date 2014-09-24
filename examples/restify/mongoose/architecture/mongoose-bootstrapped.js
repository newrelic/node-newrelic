
'use strict';

var path   = require('path')
  , logger = require('../../../../lib/logger')
  ;

/**
 * This is a c9/architect configuration file.
 */
module.exports = [
  {packagePath : path.join(__dirname, '../../../../test/integration/benchmarkr/services/mongodb'),
   dbpath      : path.join(__dirname, '../db'),
   logger      : logger.child({component : 'mongod'})
  },
  {packagePath : path.join(__dirname, 'mongoose-dal'),
   db : {
     name : 'mongoose_bootstrapped'
   },
   logger      : logger.child({component : 'mongoose_dal'})
  }
];
