'use strict';

var path    = require('path')
  , chai    = require('chai')
  , expect  = chai.expect
  , shimmer = require(path.join(__dirname, '..', 'lib', 'shimmer'))
  ;

describe('the instrumentation injector', function () {
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

  it("should still work when an NR-wrapped method is wrapped again", function () {
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
});
