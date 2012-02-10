var config = require('../lib/config');
var winston = require('winston');

var logger = new (winston.Logger)({
        transports: [ new (winston.transports.Console)()]
      });
      
exports['test agent disabled'] = function(beforeExit, assert) {
    var c = config.initialize(logger, { 'config': {'agent_enabled': false}});    
    assert.equal(false, c['agent_enabled']);
};
