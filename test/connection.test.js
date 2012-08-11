'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , logger = require(path.join(__dirname, '..', 'lib', 'logger'))
  , config = require(path.join(__dirname, '..', 'lib', 'config'))
  , Agent  = require(path.join(__dirname, '..', 'lib', 'agent'))
  ;

describe('connecting to New Relic', function () {
  var agent
    , testLicense   = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b'
    , collectorHost = 'staging-collector.newrelic.com'
    ;

  before(function () {
    agent = new Agent();
    agent.config = config.initialize(logger, {
      'config' : {
        'app_name'    : 'node.js Tests',
        'license_key' : testLicense,
        'host'        : collectorHost,
        'port'        : 80
      }
    });
    agent.applicationPort = 6666;
  });

  it('should establish a connection', function (done) {
    agent.on('connect', function () {
      expect(agent.connection).to.be.an('object');
      expect(agent.connection.applicationName).to.deep.equal(['node.js Tests']);
      agent.connection.on('connect', function () {
        agent.stop();

        return done();
      });
    });
    agent.start();
  });
});
