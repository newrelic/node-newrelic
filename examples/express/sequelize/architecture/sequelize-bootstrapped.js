'use strict';

var path   = require('path')
  , logger = require('../../../../lib/logger')
  ;

/**
 * This is a c9/architect configuration file.
 */
module.exports = [
  {packagePath : path.join(__dirname, '../../../../test/integration/benchmarkr/services/mysqld'),
   dbpath      : path.join(__dirname, '../db'),
   logger      : logger.child({component : 'mysqld'})
  },
  {packagePath : path.join(__dirname, '../../../../test/lib/bootstrap/mysql'),
   db          : {
     user  : 'test_user',
     name  : 'express_sequelize',
     table : 'test'
   },
   logger      : logger.child({component : 'mysql_bootstrap'})
  },
  {packagePath : path.join(__dirname, 'sequelize-dal'),
   db          : {
     user  : 'test_user',
     name  : 'express_sequelize'
   },
   logger      : logger.child({component : 'sequelize_dal'})
  },
];
