"use strict";

var path        = require('path')
  , chai        = require('chai')
  , should      = chai.should()
  , expect      = chai.expect
  , transaction = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe("new-school transaction tracing", function () {
  // don't add Sinon into the mix until I know what to spy on
  var agent = {name : "test application"};

  afterEach(function () {
    transaction.reset();
  });

  it("must have every transaction associated with an application", function () {
    expect(function () { transaction.create(); }).throws(/must be scoped to an application/);
  });

  it("should create new transactions on demand", function () {
    should.exist(transaction.create(agent));
  });

  it("should be able to deal with multiple active transactions", function () {
    var first  = transaction.create(agent);
    var second = transaction.create(agent);

    first.should.not.equal(second);
    transaction.active(agent).length.should.equal(2);
  });

  it("should only show active transactions per application on the active list", function () {
    var first  = transaction.create(agent);
    var second = transaction.create(agent);
    var third  = transaction.create(agent);

    transaction.active(agent).length.should.equal(3);
    first.end();
    second.end();
    transaction.active(agent).length.should.equal(1);
  });

  it("should scope the transaction to the agent", function () {
    var tt = transaction.create(agent);
    tt.end();

    should.exist(tt.application);
    tt.application.should.equal(agent);
  });

  it("should allow counting the number of transactions by application", function () {
    var firstApp    = {name : 'first'};
    var firstFirst  = transaction.create(firstApp);
    var secondFirst = transaction.create(firstApp);
    var thirdFirst  = transaction.create(firstApp);

    var secondApp    = {name : 'second'};
    var firstSecond  = transaction.create(secondApp);
    var secondSecond = transaction.create(secondApp);

    firstFirst.end();
    secondFirst.end();

    transaction.active(firstApp).length.should.equal(1);
    transaction.byApplication(firstApp).length.should.equal(3);
  });

  describe("when tracing scoped metrics", function () {
    var tt;

    beforeEach(function () {
      tt = transaction.create(agent);
    });

    it("should add traces by scope", function () {
      tt.measure('Custom/Test08', 'TEST');
      expect(tt.metrics('Custom/Test08', 'TEST')).to.not.equal(null);
    });

    it("should track the same metric name separately in separate scopes", function () {
      var one = tt.measure('Custom/Test09', 'ONCE');
      one.end();

      var other = tt.measure('Custom/Test09', 'TWICE');
      other.end();

      var third = tt.measure('Custom/Test09', 'TWICE');
      third.end();

      expect(tt.statistics('Custom/Test09', 'ONCE').toObject().calls).to.equal(1);
      expect(tt.statistics('Custom/Test09', 'TWICE').toObject().calls).to.equal(2);
    });
  });

  describe("when dealing with individual traces", function () {
    it("should add traces by name", function () {
      var tt = transaction.create(agent);

      tt.measure('Custom/Test01');
      should.exist(tt.metrics('Custom/Test01'));
    });

    it("should allow multiple traces for same name", function () {
      var TRACE_NAME = 'Custom/Test02'
        , tt = transaction.create(agent)
        , traces = []
        ;

      for (var i = 0; i < 5; i++) {
        traces[i] = tt.measure(TRACE_NAME);
        traces[i].end();
      }

      tt.end();

      expect(tt.statistics(TRACE_NAME).toObject().calls).to.equal(traces.length);
    });

    it("should allow multiple overlapping traces for same name", function (done) {
      var TRACE_NAME = 'Custom/Test06'
        , SLEEP_DURATION = 43
        , tt = transaction.create(agent)
        ;

      var first = tt.measure(TRACE_NAME);
      var second = tt.measure(TRACE_NAME);
      second.end();

      setTimeout(function () {
        // this will automatically close out any open transactions,
        // so in this case will close the first transaction
        tt.end();

        var statistics = tt.statistics(TRACE_NAME).toObject();
        expect(statistics.calls).to.equal(2);
        expect(statistics.max).to.be.above(SLEEP_DURATION - 1);

        return done();
      }, SLEEP_DURATION);
    });

    it("shouldn't trace calls added after the transaction has finished", function () {
      var tt = transaction.create(agent);

      tt.measure('Custom/Test03');
      tt.end();

      tt.measure('Custom/Test04');
      should.not.exist(tt.metrics('Custom/Test04'));
    });

    describe("when fetching statistics", function () {
      it("should return statistics properly", function () {
        var tt = transaction.create(agent);

        tt.measure('Custom/Test05');
        tt.end();

        expect(tt.statistics('Custom/Test05').toJSON()).to.deep.equal([1, 0, 0, 0, 0, 0]);
      });
    });
  });

  describe("when producing a summary of the whole transaction", function () {
    var tt;

    beforeEach(function () {
      tt = transaction.create(agent);

      // scoped metrics
      tt.measure('Custom/Test11', 'TEST').end();
      tt.measure('Custom/Test12', 'TEST').end();
      tt.measure('Custom/Test11', 'ANOTHER').end();

      // unscoped metrics
      tt.measure('Custom/Lucky13').end();
      tt.measure('Custom/Lucky13').end();
      tt.measure('Custom/Lucky13').end();
      tt.measure('Custom/Test14').end();
      tt.measure('Custom/Test15').end();

      tt.end();
    });

    it("should be returned when statistics is called with no parameters", function () {
      var summary = tt.statistics();

      expect(summary.scoped.TEST['Custom/Test11'].toJSON()[0]).to.equal(1);
      expect(summary.scoped.TEST['Custom/Test12'].toJSON()[0]).to.equal(1);
      expect(summary.scoped.ANOTHER['Custom/Test11'].toJSON()[0]).to.equal(1);
      expect(summary.unscoped['Custom/Lucky13'].toJSON()[0]).to.equal(3);
      expect(summary.unscoped['Custom/Test14'].toJSON()[0]).to.equal(1);
      expect(summary.unscoped['Custom/Test15'].toJSON()[0]).to.equal(1);
    });

    it("should be returned when summary is called", function () {
      var summary = tt.summary();

      expect(summary.scoped.TEST['Custom/Test11'].toJSON()[0]).to.equal(1);
      expect(summary.scoped.TEST['Custom/Test12'].toJSON()[0]).to.equal(1);
      expect(summary.scoped.ANOTHER['Custom/Test11'].toJSON()[0]).to.equal(1);
      expect(summary.unscoped['Custom/Lucky13'].toJSON()[0]).to.equal(3);
      expect(summary.unscoped['Custom/Test14'].toJSON()[0]).to.equal(1);
      expect(summary.unscoped['Custom/Test15'].toJSON()[0]).to.equal(1);
    });
  });
});
