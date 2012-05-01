var should = require('should')
  , path = require('path')
  , nr = require(path.join(__dirname, '..', 'lib', 'newrelic_agent.js'))
  ;

describe('the New Relic agent', function () {
  var agent;

  before(function (done) {
    agent = nr.agent;

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
    should.exist(agent.errorService);

    return done();
  });

  it('should expose its configured metricNormalizer directly', function (done) {
    should.exist(agent.metricNormalizer);

    return done();
  });

  describe("when triggering events defined on the agent", function () {
    var connection;

    before(function (done) {
      agent.on('connect', function () {
        connection = agent.connection;
        should.exist(connection);

        return done();
      });
    });

    after(function (done) {
      agent.stop();

      return done();
    });

    it("should fire the statsEngine.onConnect handler when the config is changed", function (done) {
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
});
