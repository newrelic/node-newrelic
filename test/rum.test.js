'use strict';

var path   = require('path')
  , helper = require(path.join(__dirname, 'lib', 'agent_helper.js'))
  , API    = require(path.join(__dirname, '..', 'api.js'))
  ;

describe("the RUM API", function () {
  var agent
    , api
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    api = new API(agent);
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it('should return blank outside a transaction', function () {
    api.getRUMHeader().should.equal('<!-- why is the rum gone? -->');
  });

  it('should return warning if transaction has no name', function () {
    helper.runInTransaction(agent, function () {
      api.getRUMHeader().should.equal('<!-- why is the rum gone? -->');
    });
  });

  it('should return the rum headers when in a named transaction', function () {
    helper.runInTransaction(agent, function (t) {
      t.setName('hello');
      api.getRUMHeader().indexOf('<script').should.equal(0);
    });
  });

});
