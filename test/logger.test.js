'use strict';

var path = require('path')
  , chai = require('chai')
  , expect = chai.expect
  , logger = require(path.join(__dirname, '..', 'lib', 'logger'))
  ;

describe("Logger", function () {
  describe("when setting values", function () {
    it("shouldn't throw when passed-in log level is 0", function () {
      expect(function () { logger.level(0); }).not.throws();
    });

    it("shouldn't throw when passed-in log level is ONE MILLION", function () {
      expect(function () { logger.level(1000000); }).not.throws();
    });

    it("shouldn't throw when passed-in log level is 'verbose'", function () {
      expect(function () { logger.level('verbose'); });
    });
  });
});
