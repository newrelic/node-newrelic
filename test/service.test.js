var winston = require('winston');
var service = require('../lib/service');
var config = require('../lib/config');
var logger = require('../lib/logger').getLogger();

var agent = require('./test_agent').createAgent();

var testLicense = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b';

exports['test conn'] = function(beforeExit, assert) {
	var c = config.initialize(logger, { 'config': {'license_key': testLicense, 'host':'staging-collector.newrelic.com', 'port':80 }});
    var nr = service.createNewRelicService(agent, c);
    var connected = false;
    nr.on('connect', function() {
        connected = true;
    });
    nr.connect();
    
    beforeExit(function() {
        assert.ok(connected);
    });
};
