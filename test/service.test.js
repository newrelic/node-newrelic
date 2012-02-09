var winston = require('winston');
var service = require('../lib/service.js');
var logger = require('../lib/logger.js').getLogger();

var agent = require('./test_agent.js').createAgent();

var testLicense = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b';

exports['test conn'] = function(beforeExit, assert) {
    var nr = service.createNewRelicService(agent, testLicense, 'staging-collector.newrelic.com', 80);
    var connected = false;
    nr.on('connect', function(error) {
        connected = true;
    });
    nr.connect();
    
    beforeExit(function() {
        assert.ok(connected);
    });
}
