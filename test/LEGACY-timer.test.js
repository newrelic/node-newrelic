'use strict';

var path    = require('path')
  , chai    = require('chai')
  , should  = chai.should()
  , Timer   = require(path.join(__dirname, '..', 'lib', 'trace-legacy', 'timer'))
  ;

describe('legacy timer class', function () {
  describe('when working with raw timer instances', function () {
    it('should have a start defined on creation', function () {
      var timer = new Timer();
      should.exist(timer.start);
      timer.start.should.be.above(0);
    });

    it('should not have a end defined on creation', function () {
      var timer = new Timer();
      should.not.exist(timer.end);
    });
  });
});
