'use strict';

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , helper = require(path.join(__dirname, 'lib', 'agent_helper.js'))
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

  it("exports a transaction naming function", function () {
    should.exist(api.setTransactionName);
    expect(api.setTransactionName).a('function');
  });

  it("exports a controller naming function", function () {
    should.exist(api.setControllerName);
    expect(api.setControllerName).a('function');
  });

  it("exports a function for adding naming rules", function () {
    should.exist(api.addNamingRule);
    expect(api.addNamingRule).a('function');
  });

  it("exports a function for ignoring certain URLs", function () {
    should.exist(api.addIgnoringRule);
    expect(api.addIgnoringRule).a('function');
  });

  describe("when explicitly naming transactions", function () {
    describe("in the simplest case", function () {
      var segment
        , transaction
        ;

      beforeEach(function (done) {
        agent.on('transactionFinished', function (t) {
          // grab transaction
          transaction = t;
          transaction.setName(URL, 200);
          segment.markAsWeb(URL);
          done();
        });

        helper.runInTransaction(agent, function (transaction) {
          // set up web segment
          var state = agent.tracer.getState();
          // grab segment
          segment = state.getSegment().add(NAME);

          // HTTP instrumentation sets URL as soon as it knows it
          transaction.url = URL;
          transaction.verb = 'POST';

          // NAME THE TRANSACTION
          api.setTransactionName('Test');

          transaction.end();
        });
      });

      it("sets the transaction name to the custom name", function () {
        expect(transaction.name).equal('WebTransaction/Custom/Test');
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
        transaction.setName(URL, 200);

        expect(transaction.name).equal('WebTransaction/Custom/List');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state = agent.tracer.getState();

        segment          = state.getSegment().add(NAME);
        transaction.url  = URL;
        transaction.verb = 'GET';

        // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
        api.setTransactionName('Index');
        api.setTransactionName('Update');
        api.setTransactionName('Delete');
        api.setTransactionName('List');

        transaction.end();
      });
    });
  });

  describe("when explicitly naming controllers", function () {
    describe("in the simplest case", function () {
      var segment
        , transaction
        ;

      beforeEach(function (done) {
        agent.on('transactionFinished', function (t) {
          // grab transaction
          transaction = t;
          t.setName(URL, 200);
          segment.markAsWeb(URL);
          done();
        });

        helper.runInTransaction(agent, function (transaction) {
          // set up web segment
          var state = agent.tracer.getState();
          // grab segment
          segment = state.getSegment().add(NAME);

          // HTTP instrumentation sets URL as soon as it knows it
          transaction.url = URL;
          transaction.verb = 'POST';

          // NAME THE CONTROLLER
          api.setControllerName('Test');

          transaction.end();
        });
      });

      it("sets the controller in the transaction name", function () {
        expect(transaction.name).equal('WebTransaction/Controller/Test/POST');
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
        transaction.setName(URL, 200);

        expect(transaction.name).equal('WebTransaction/Controller/Test/DELETE');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state   = agent.tracer.getState();
        segment = state.getSegment().add(NAME);

        transaction.url = URL;

        // SET THE ACTION
        transaction.verb = 'DELETE';

        // NAME THE CONTROLLER
        api.setControllerName('Test');

        transaction.end();
      });
    });

    it("allows a custom action", function (done) {
      var segment;

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200);

        expect(transaction.name).equal('WebTransaction/Controller/Test/index');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state = agent.tracer.getState();

        segment          = state.getSegment().add(NAME);
        transaction.url  = URL;
        transaction.verb = 'GET';

        // NAME THE CONTROLLER AND ACTION
        api.setControllerName('Test', 'index');

        transaction.end();
      });
    });

    it("uses the last controller set when called multiple times", function (done) {
      var segment;

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200);

        expect(transaction.name).equal('WebTransaction/Controller/Test/list');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state = agent.tracer.getState();

        segment          = state.getSegment().add(NAME);
        transaction.url  = URL;
        transaction.verb = 'GET';

        // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
        api.setControllerName('Test', 'index');
        api.setControllerName('Test', 'update');
        api.setControllerName('Test', 'delete');
        api.setControllerName('Test', 'list');

        transaction.end();
      });
    });
  });

  describe("when handed a new naming rule", function () {
    it("should add it to the agent's normalizer", function () {
      expect(agent.urlNormalizer.rules.length).equal(0);
      api.addNamingRule('^/simple.*', 'API');
      expect(agent.urlNormalizer.rules.length).equal(1);
    });

    describe("in the base case", function () {
      var mine;
      beforeEach(function () {
        agent.urlNormalizer.load([
          {each_segment : true, eval_order : 0, terminate_chain : false,
           match_expression : '^(test_match_nothing)$',
           replace_all : false, ignore : false, replacement : '\\1'},
          {each_segment : true, eval_order : 1, terminate_chain : false,
           match_expression : '^[0-9][0-9a-f_,.-]*$',
           replace_all : false, ignore : false, replacement : '*'},
          {each_segment : false, eval_order : 2, terminate_chain : false,
           match_expression : '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
           replace_all : false, ignore : false, replacement : '\\1/.*\\2'}
        ]);

        api.addNamingRule('^/test/.*', 'Test');
        mine = agent.urlNormalizer.rules[0];
      });

      it("should add it to the agent's normalizer", function () {
        expect(agent.urlNormalizer.rules.length).equal(4);
      });

      it("should leave the passed-in pattern alone", function () {
        expect(mine.pattern.source).equal('^/test/.*');
      });

      it("should have the correct replacement", function () {
        expect(mine.replacement).equal('/Test');
      });

      it("should set it to highest precedence", function () {
        expect(mine.precedence).equal(0);
      });

      it("should end further normalization", function () {
        expect(mine.isTerminal).equal(true);
      });

      it("should only apply it to the whole URL", function () {
        expect(mine.eachSegment).equal(false);
      });
    });

    it("applies a string pattern correctly", function (done) {
      var segment;

      api.addNamingRule('^/test/.*', 'Test');

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200);

        expect(transaction.name).equal('WebTransaction/NormalizedUri/Test');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state = agent.tracer.getState();

        segment          = state.getSegment().add(NAME);
        transaction.url  = URL;
        transaction.verb = 'GET';

        transaction.end();
      });
    });

    it("applies a regex pattern with capture groups correctly", function (done) {
      var segment;

      api.addNamingRule(/^\/test\/(.*)\/(.*)/, 'Test/$2');

      agent.on('transactionFinished', function (transaction) {
        transaction.setName('/test/31337/related', 200);

        expect(transaction.name).equal('WebTransaction/NormalizedUri/Test/related');

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state = agent.tracer.getState();

        segment          = state.getSegment().add(NAME);
        transaction.url  = '/test/31337/related';
        transaction.verb = 'GET';

        transaction.end();
      });
    });
  });

  describe("when handed a new pattern to ignore", function () {
    it("should add it to the agent's normalizer", function () {
      expect(agent.urlNormalizer.rules.length).equal(0);
      api.addIgnoringRule('^/simple.*');
      expect(agent.urlNormalizer.rules.length).equal(1);
    });

    describe("in the base case", function () {
      var mine;
      beforeEach(function () {
        agent.urlNormalizer.load([
          {each_segment : true, eval_order : 0, terminate_chain : false,
           match_expression : '^(test_match_nothing)$',
           replace_all : false, ignore : false, replacement : '\\1'},
          {each_segment : true, eval_order : 1, terminate_chain : false,
           match_expression : '^[0-9][0-9a-f_,.-]*$',
           replace_all : false, ignore : false, replacement : '*'},
          {each_segment : false, eval_order : 2, terminate_chain : false,
           match_expression : '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
           replace_all : false, ignore : false, replacement : '\\1/.*\\2'}
        ]);

        api.addIgnoringRule('^/test/.*');
        mine = agent.urlNormalizer.rules[0];
      });

      it("should add it to the agent's normalizer", function () {
        expect(agent.urlNormalizer.rules.length).equal(4);
      });

      it("should leave the passed-in pattern alone", function () {
        expect(mine.pattern.source).equal('^/test/.*');
      });

      it("should have the correct replacement", function () {
        expect(mine.replacement).equal('$0');
      });

      it("should set it to highest precedence", function () {
        expect(mine.precedence).equal(0);
      });

      it("should end further normalization", function () {
        expect(mine.isTerminal).equal(true);
      });

      it("should only apply it to the whole URL", function () {
        expect(mine.eachSegment).equal(false);
      });

      it("should ignore transactions related to that URL", function () {
        expect(mine.ignore).equal(true);
      });
    });

    it("applies a string pattern correctly", function (done) {
      var segment;

      api.addIgnoringRule('^/test/.*');

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200);

        expect(transaction.ignore).equal(true);

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var state = agent.tracer.getState();

        segment          = state.getSegment().add(NAME);
        transaction.url  = URL;
        transaction.verb = 'GET';

        transaction.end();
      });
    });
  });
});
