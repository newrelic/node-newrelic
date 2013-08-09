'use strict';

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , web         = require(path.join(__dirname, '..', 'lib', 'transaction', 'web.js'))
  , helper      = require(path.join(__dirname, 'lib', 'agent_helper'))
  , Transaction = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe("NR web utilities", function () {
  var agent
    , trans
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    trans = new Transaction(agent);
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it("shouldn't crash when measuring URL paths without a leading slash", function () {
    var trans = new Transaction(agent);
    expect(function () {
      web.normalizeAndName(trans.getTrace().root, '?t_u=http://some.com/o/p', 200);
      expect(trans.url).equal('/');
    }).not.throws();
  });
});
