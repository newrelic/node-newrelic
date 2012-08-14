'use strict';

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe('the New Relic agent', function () {
  describe("when working with a live connection to the service, created in the traditional manner", function () {
    var agent;

    before(function (done) {
      agent = helper.loadAgent();

      return done();
    });

    after(function (done) {
      var deaded = helper.unloadAgent(agent);
      should.exist(deaded);

      return done();
    });

    it("should start up properly", function (done) {
      should.exist(agent, 'agent exists');

      agent.on('connect', function () {
        should.exist(agent.connection, 'connection exists');

        return done();
      });

      agent.noticeAppPort(6666);
    });
  });

  describe("when working offline with a mocked service connection", function () {
    var agent
      , connection
      ;

    before(function (done) {
      agent = helper.loadMockedAgent();

      agent.on('connect', function () {
        connection = agent.connection;
        should.exist(connection);

        return done();
      });

      agent.noticeAppPort(6666);
    });

    after(function (done) {
      var deaded = helper.unloadAgent(agent);

      return done();
    });

    it('should expose its configured statsEngine directly', function (done) {
      should.exist(agent.statsEngine);

      return done();
    });

    it('should expose its configuration directly', function (done) {
      should.exist(agent.config);

      return done();
    });

    it('should expose its configured errorService directly', function (done) {
      should.exist(agent.errors);

      return done();
    });

    it('should expose its configured metricNormalizer directly', function (done) {
      should.exist(agent.metricNormalizer);

      return done();
    });

    describe("when dealing with its event handlers", function () {
      describe("when setting up event subscriptions", function () {
        it("should have one handler defined on the 'change' event on the agent's configuration", function (done) {
          agent.config.listeners('change').length.should.equal(1);

          return done();
        });

        it("should have two handlers defined on the 'connect' event on the agent", function (done) {
          connection.listeners('connect').length.should.equal(2);

          return done();
        });

        it("should have one handler defined on the 'metricDataError' event on the agent", function (done) {
          connection.listeners('metricDataError').length.should.equal(1);

          return done();
        });

        it("should have one handler defined on the 'metricDataResponse' event on the agent", function (done) {
          connection.listeners('metricDataResponse').length.should.equal(1);

          return done();
        });

        it("should have one handler defined on the 'errorDataError' event on the agent", function (done) {
          connection.listeners('errorDataError').length.should.equal(1);

          return done();
        });

        it("should have one handler defined on the 'connectError' event on the agent", function (done) {
          connection.listeners('connectError').length.should.equal(1);

          return done();
        });
      });

      describe("when signaling events out of band", function () {
        it("should reset the stats engine's ApdexT value when the configuration is changed", function (done) {
          should.not.exist(agent.statsEngine.apdexT);
          process.nextTick(function () {
            should.exist(agent.statsEngine.apdexT);
            agent.statsEngine.apdexT.should.equal(0.666);

            return done();
          });

          agent.config.emit('change', {'apdex_t' : 0.666});
        });

        it("should reset the configuration and metrics normalizer when the agent connects", function (done) {
          should.not.exist(agent.config.apdex_t);
          process.nextTick(function () {
            should.exist(agent.config.apdex_t);
            agent.config.apdex_t.should.equal(0.742);

            should.exist(agent.statsEngine.apdexT);
            agent.statsEngine.apdexT.should.equal(0.742);

            should.exist(agent.metricNormalizer.rules);
            agent.metricNormalizer.rules.should.eql([0]);

            return done();
          });

          connection.emit('connect', {'apdex_t' : 0.742, url_rules : [0]});
        });

        it("should parse metrics responses when metric data is received", function (done) {
          var STATNAME = "Custom/Test/events";
          var SCOPE    = "TEST";
          var METRICID = "test000000001";

          var testIDs = {};
          testIDs[STATNAME + ',' + SCOPE] = METRICID;

          agent.statsEngine.metricIds.should.eql([]);
          process.nextTick(function () {
            agent.statsEngine.metricIds.should.eql(testIDs);

            return done();
          });

          connection.emit('metricDataResponse', [[{"name" : STATNAME, "scope" : SCOPE}, METRICID]]);
        });
      });
    });
  });
});
