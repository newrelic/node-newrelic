'use strict';

var path                = require('path')
  , chai                = require('chai')
  , should              = chai.should()
  , logger              = require(path.join(__dirname, '..', 'lib', 'logger'))
  , config              = require(path.join(__dirname, '..', 'lib', 'config'))
  , CollectorConnection = require(path.join(__dirname, '..', 'lib', 'collector', 'connection'))
  , FakeyMcAgent        = require(path.join(__dirname, 'lib', 'stub_agent'))
  ;

describe('connecting to New Relic', function () {
  var agent
    , configuration
    , newRelic
    , testLicense   = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b'
    , collectorHost = 'staging-collector.newrelic.com'
    ;

  before(function () {
    agent = new FakeyMcAgent();
    configuration = config.initialize(logger, {
      'config' : {
        'app_name'    : 'node.js Tests',
        'license_key' : testLicense,
        'host'        : collectorHost,
        'port'        : 80
      }
    });
    agent.config = configuration;
    newRelic = new CollectorConnection(agent);
  });

  after(function () {
    agent.stop();
  });

  it('should establish a connection', function (done) {
    newRelic.on('connect', function () {
      // TODO: this should test more, and handle failure better.
      return done();
    });
    newRelic.connect();
  });
});
