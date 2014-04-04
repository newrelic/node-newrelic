'use strict';

var path   = require('path')
  , chai   = require('chai')
  , helper = require(path.join(__dirname, 'lib', 'agent_helper.js'))
  , facts    = require(path.join(__dirname, '..', 'lib', 'collector', 'facts.js'))
  , API    = require(path.join(__dirname, '..', 'api.js'))
  ;

chai.should();

describe("high security mode", function () {
  var agent
    , api
    , factoids
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    api = new API(agent);
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it('should contain security_settings', function () {
    /*jshint expr:false*/
    factoids = facts(agent);
    factoids.security_settings.should.not.equal(null);
  });

  it('should record capture_params', function () {
    agent.config.capture_params = true;
    factoids = facts(agent);
    factoids.security_settings.capture_params.should.equal(true);
  });

  it('should have capture_params false by default', function () {
    factoids = facts(agent);
    factoids.security_settings.capture_params.should.equal(false);
  });

  it('should record transaction_tracer.record_sql', function () {
    agent.config.transaction_tracer.record_sql = true;
    factoids = facts(agent);
    factoids.security_settings.transaction_tracer.record_sql.should.equal(true);
  });

  it('should have transaction_tracer.record_sql off by default', function () {
    factoids = facts(agent);
    factoids
      .security_settings
      .transaction_tracer
      .record_sql
      .should
      .equal('off');
  });
});
