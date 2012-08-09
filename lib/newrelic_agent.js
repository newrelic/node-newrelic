'use strict';

var path  = require('path')
  , Agent = require(path.join(__dirname, 'agent'))
  ;

var agent;
var invocationOptions;

module.exports = function (options) {
  if (!options && !invocationOptions && agent) return agent;

  invocationOptions = options;

  agent = new Agent(options);
  agent.start();

  return agent;
};
