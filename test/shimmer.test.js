'use strict';

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  , shimmer      = require(path.join(__dirname, '..', 'lib', 'shimmer'))
  , transaction  = require(path.join(__dirname, '..', 'lib', 'transaction', 'manager'))
  , EventEmitter = require('events').EventEmitter
  ;

describe("the instrumentation injector", function () {
  var nodule = {
    c : 2,
    ham : 'ham',
    doubler : function (x, cb) {
      cb(this.c + x * 2);
    },
    tripler : function (y, cb) {
      cb(this.c + y * 3);
    },
    hammer : function (h, cb) {
      cb(this.ham + h);
    }
  };

  it("should wrap a method", function () {
    var doubled = 0;
    var before = false;
    var after = false;

    shimmer.wrapMethod(nodule, 'nodule', 'doubler', function (original) {
      return function () {
        before = true;
        original.apply(this, arguments);
        after = true;
      };
    });

    expect(nodule.doubler.__NR_unwrap).a('function');

    nodule.doubler(7, function(z) { doubled = z; });

    expect(doubled).equal(16);
    expect(before).equal(true);
    expect(after).equal(true);
  });

  it("should wrap, then unwrap a method", function () {
    var tripled = 0;
    var before = false;
    var after = false;

    shimmer.wrapMethod(nodule, 'nodule', 'tripler', function (original) {
      return function () {
        before = true;
        original.apply(this, arguments);
        after = true;
      };
    });

    nodule.tripler(7, function(z) { tripled = z; });

    expect(tripled).equal(23);
    expect(before).equal(true);
    expect(after).equal(true);

    before = false;
    after = false;

    shimmer.unwrapMethod(nodule, 'nodule', 'tripler');

    nodule.tripler(9, function(j) { tripled = j; });

    expect(tripled).equal(29);
    expect(before).equal(false);
    expect(after).equal(false);
  });

  it("shouldn't break anything when an NR-wrapped method is wrapped again", function () {
    var hamceptacle = '';
    var before = false;
    var after = false;
    var hammed = false;

    shimmer.wrapMethod(nodule, 'nodule', 'hammer', function (original) {
      return function () {
        before = true;
        original.apply(this, arguments);
        after = true;
      };
    });

    // monkey-patching the old-fashioned way
    var hammer = nodule.hammer;
    nodule.hammer = function () {
      hammer.apply(this, arguments);
      hammed = true;
    };

    nodule.hammer('Burt', function (k) { hamceptacle = k; });

    expect(hamceptacle).equal('hamBurt');
    expect(before).equal(true);
    expect(after).equal(true);
    expect(hammed).equal(true);
  });

  it("should scope transactions to the appropriate context", function (done) {
    var agent = helper.loadMockedAgent();
    var current;
    var synchronizer = new EventEmitter();

    var spamTransaction = function () {
      current = transaction.create(agent);
      process.nextTick(function () {
        var lookup = agent.getTransaction();
        expect(lookup).equal(current);

        synchronizer.emit('inner', lookup);
      });
    };

    var doneCount = 0;
    var transactions = [];
    synchronizer.on('inner', function (trans) {
      doneCount += 1;
      transactions.push(trans);
      expect(trans).equal(current);

      if (doneCount === 10) return done();
    });

    for (var i = 0; i < 10; i += 1) {
      process.nextTick(spamTransaction);
    }
  });
});
