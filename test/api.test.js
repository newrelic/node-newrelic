'use strict';

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , helper = require(path.join(__dirname, 'lib', 'agent_helper.js'))
  , web    = require(path.join(__dirname, '..', 'lib', 'transaction', 'web.js'))
  , API    = require(path.join(__dirname, '..', 'api.js'))
  ;

describe("the New Relic agent API", function () {
  var URL     = '/test/path/31337'
    , NAME    = 'WebTransaction/Uri/test/path/31337'
    , agent
    , api
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    api = new API(agent);
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it("exports a transaction naming method", function () {
    should.exist(api.nameTransaction);
    expect(api.nameTransaction).a('function');
  });

  it("exports a controller naming method", function () {
    should.exist(api.nameController);
    expect(api.nameController).a('function');
  });

  describe("with explicit transaction naming", function () {
    describe("in the simplest case", function () {
      var segment
        , transaction
        ;

      beforeEach(function (done) {
        agent.on('transactionFinished', function (t) {
          web.normalizeAndName(segment, URL, 200);
          // grab transaction
          transaction = t;
          done();
        });

        helper.runInTransaction(agent, function (transaction) {
          // set up web segment
          var state = agent.getState();
          // grab segment
          segment = state.getSegment().add(NAME);

          // HTTP instrumentation sets URL as soon as it knows it
          transaction.url = '/test/path/31337';
          transaction.verb = 'POST';

          // NAME THE TRANSACTION
          api.nameTransaction('Test');

          transaction.end();
        });
      });

      it("sets the transaction scope to the custom name", function () {
        expect(transaction.scope).equal('WebTransaction/Custom/Test');
      });

      it("names the web trace segment after the custom name", function () {
        expect(segment.name).equal('WebTransaction/Custom/Test');
      });

      it("leaves the request URL alone", function () {
        expect(transaction.url).equal(URL);
      });
    });

    it("uses the last name set when called multiple times", function (done) {
      var segment;

      agent.on('transactionFinished', function (transaction) {
        web.normalizeAndName(segment, URL, 200);

        expect(transaction.scope).equal('WebTransaction/Custom/List');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state = agent.getState();

        segment          = state.getSegment().add(NAME);
        transaction.url  = '/test/path/31337';
        transaction.verb = 'GET';

        // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
        api.nameTransaction('Index');
        api.nameTransaction('Update');
        api.nameTransaction('Delete');
        api.nameTransaction('List');

        transaction.end();
      });
    });
  });

  describe("with explicit controller naming", function () {
    describe("in the simplest case", function () {
      var segment
        , transaction
        ;

      beforeEach(function (done) {
        agent.on('transactionFinished', function (t) {
          web.normalizeAndName(segment, URL, 200);
          // grab transaction
          transaction = t;
          done();
        });

        helper.runInTransaction(agent, function (transaction) {
          // set up web segment
          var state = agent.getState();
          // grab segment
          segment = state.getSegment().add(NAME);

          // HTTP instrumentation sets URL as soon as it knows it
          transaction.url = '/test/path/31337';
          transaction.verb = 'POST';

          // NAME THE CONTROLLER
          api.nameController('Test');

          transaction.end();
        });
      });

      it("sets the controller in the transaction scope", function () {
        expect(transaction.scope).equal('WebTransaction/Controller/Test/POST');
      });

      it("names the web trace segment after the controller", function () {
        expect(segment.name).equal('WebTransaction/Controller/Test/POST');
      });

      it("leaves the request URL alone", function () {
        expect(transaction.url).equal(URL);
      });
    });

    it("uses the HTTP verb for the default action", function (done) {
      var segment;

      agent.on('transactionFinished', function (transaction) {
        web.normalizeAndName(segment, URL, 200);

        expect(transaction.scope).equal('WebTransaction/Controller/Test/DELETE');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state   = agent.getState();
        segment = state.getSegment().add(NAME);

        transaction.url = '/test/path/31337';

        // SET THE ACTION
        transaction.verb = 'DELETE';

        // NAME THE CONTROLLER
        api.nameController('Test');

        transaction.end();
      });
    });

    it("allows a custom action", function (done) {
      var segment;

      agent.on('transactionFinished', function (transaction) {
        web.normalizeAndName(segment, URL, 200);

        expect(transaction.scope).equal('WebTransaction/Controller/Test/index');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state = agent.getState();

        segment          = state.getSegment().add(NAME);
        transaction.url  = '/test/path/31337';
        transaction.verb = 'GET';

        // NAME THE CONTROLLER AND ACTION
        api.nameController('Test', 'index');

        transaction.end();
      });
    });

    it("uses the last controller set when called multiple times", function (done) {
      var segment;

      agent.on('transactionFinished', function (transaction) {
        web.normalizeAndName(segment, URL, 200);

        expect(transaction.scope).equal('WebTransaction/Controller/Test/list');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state = agent.getState();

        segment          = state.getSegment().add(NAME);
        transaction.url  = '/test/path/31337';
        transaction.verb = 'GET';

        // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
        api.nameController('Test', 'index');
        api.nameController('Test', 'update');
        api.nameController('Test', 'delete');
        api.nameController('Test', 'list');

        transaction.end();
      });
    });
  });
});
