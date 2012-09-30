'use strict';

var path   = require('path')
  , Logger = require('bunyan')
  ;

module.exports = new Logger({
  name    : 'newrelic',
  streams : [{
    level : 'trace',
    name  : 'file',
    path  : path.join(process.cwd(), 'newrelic_agent.log')
  }]
});
