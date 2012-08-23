'use strict';

var path    = require('path')
  , winston = require('winston')
  ;

var levels = {
  verbose : 0,
  debug   : 1,
  info    : 2,
  warn    : 3,
  error   : 4
};

var logger = new winston.Logger({
  levels : levels,
  transports : [
    new (winston.transports.File)({
      filename         : path.join(process.cwd(), 'newrelic_agent.log'),
      json             : false,
      timestamp        : true,
      level            : 'verbose'
    })
  ]
});

module.exports = logger;
