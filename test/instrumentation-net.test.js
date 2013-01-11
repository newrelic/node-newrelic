'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , net    = require('net')
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("built-in net module instrumentation", function () {
  var agent
    , server
    , RESPONSE = 'WHANGADANG\n'
    , PORT     = 9876
    ;

  beforeEach(function (done) {
    agent = helper.instrumentMockedAgent();

    server = net.createServer(function (conn) {
      conn.write(RESPONSE);
      conn.pipe(conn);
    });

    server.listen(PORT, 'localhost', function () { return done(); });
  });

  afterEach(function (done) {
    server.on('close', function () {
      helper.unloadAgent(agent);

      return done();
    });

    server.close();
  });

  it("should have noticed the application port", function (done) {
    var client = net.connect(PORT, 'localhost');

    client.on('data', function (data) {
      data.toString().should.equal(RESPONSE);
      client.end();
    });

    client.on('end', function () {
      agent.applicationPort.should.equal(PORT);

      return done();
    });
  });

  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'core', 'net'));
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed an empty module", function () {
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });

});
