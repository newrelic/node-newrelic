'use strict';

var path        = require('path')
  , events      = require('events')
  , util        = require('util')
  , logger      = require(path.join(__dirname, '..', '..', 'lib', 'logger'))
  , StatsEngine = require(path.join(__dirname, '..', '..', 'lib', 'stats', 'engine'))
  , trace       = require(path.join(__dirname, '..', '..', 'lib', 'trace'))
  ;

function StubAgent() {
  events.EventEmitter.call(this);

  logger.setLevel('debug');

  this.transactions = [];
  this.transactionFinished = function (transaction) {
    this.transactions.push(transaction);
  };

  this.statsEngine = new StatsEngine();
  trace.setTransactions(this);

  this.config = require('../../lib/config').initialize(logger, {'config':{'app_name':'node.js Tests'}});

  this.version = '0.66.6';

  this.clearTransaction = function () {};

  this.environment = {
    toJSON : function () {
      return {
        "Processors" : 2,
        "OS"         : 'BOGONUXX',
        "OS version" : "1.15",
        "Arch"       : "z80"
      };
    }
  };
}
util.inherits(StubAgent, events.EventEmitter);

StubAgent.prototype.stop = function () {
  trace.resetTransactions();
};

module.exports = StubAgent;
