'use strict';

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , should      = chai.should()
  , helper      = require(path.join(__dirname, 'lib', 'agent_helper'))
  , transaction = require(path.join(__dirname, '..', 'lib', 'transaction', 'manager'))
  , Agent       = require(path.join(__dirname, '..', 'lib', 'agent'))
  ;

describe("the transaction API", function () {
  // don't add Sinon into the mix until I know what to spy on
  var agent = helper.loadMockedAgent();

  afterEach(function () {
    transaction.reset();
  });

  it("should require an agent to create new transactions", function () {
    expect(function () { transaction.create(); }).throws(/must be bound to the agent/);
  });

  it("should create new transactions on demand", function () {
    expect(function () { transaction.create(agent); }).not.throws();
  });

  it("should be able to manage multiple active transactions", function () {
    var first  = transaction.create(agent);
    var second = transaction.create(agent);

    first.should.not.equal(second);
    transaction.getActiveByApplication(agent).length.should.equal(2);

    first.end();
    second.end();
  });

  it("should only show active transactions per application on the active list", function () {
    var first  = transaction.create(agent);
    var second = transaction.create(agent);
    var third  = transaction.create(agent);

    transaction.getActiveByApplication(agent).length.should.equal(3);
    first.end();
    second.end();
    transaction.getActiveByApplication(agent).length.should.equal(1);
    transaction.getActiveByApplication(agent)[0].should.equal(third);

    // if instrumentation is enabled, be sure to terminate transactions
    third.end();
  });

  it("should bind new transactions to the agent", function () {
    var tt = transaction.create(agent);
    tt.end();

    tt.agent.should.equal(agent);
  });

  it("should group transactions by application", function () {
    var firstApp              = helper.loadMockedAgent();
    firstApp.config.app_name  = ['first'];
    var firstFirst            = transaction.create(firstApp);
    var secondFirst           = transaction.create(firstApp);
    var thirdFirst            = transaction.create(firstApp);

    var secondApp             = helper.loadMockedAgent();
    secondApp.config.app_name = ['second'];
    var firstSecond           = transaction.create(secondApp);
    var secondSecond          = transaction.create(secondApp);

    firstFirst.end();
    secondFirst.end();

    transaction.getActiveByApplication(firstApp).length.should.equal(1);
    transaction.getByApplication(firstApp).length.should.equal(3);

    // if instrumentation is enabled, be sure to terminate transactions
    thirdFirst.end();
    firstSecond.end();
    secondSecond.end();
  });
});
