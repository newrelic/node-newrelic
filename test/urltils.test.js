'use strict';

var path    = require('path')
  , chai    = require('chai')
  , expect  = chai.expect
  , urltils = require(path.join(__dirname, '..', 'lib', 'util', 'urltils.js'))
  ;

describe("NR URL utilities", function () {
  describe("scrubbing URLs", function () {
    it("should return '/' if there's no leading slash on the path", function () {
      expect(urltils.scrub('?t_u=http://some.com/o/p')).equal('/');
    });
  });

  describe("determining whether an HTTP status code is an error", function () {
    var config = {error_collector : {ignore_status_codes : []}};

    it("shouldn't throw when called with no params", function () {
      expect(function () { urltils.isError(); }).not.throws();
    });

    it("shouldn't throw when called with no code", function () {
      expect(function () { urltils.isError(config); }).not.throws();
    });

    it("shouldn't throw when config is missing", function () {
      expect(function () { urltils.isError(null, 200); }).not.throws();
    });

    it("should NOT mark an OK request as an error", function () {
      return expect(urltils.isError(config, 200)).false;
    });

    it("should NOT mark a permanent redirect as an error", function () {
      return expect(urltils.isError(config, 301)).false;
    });

    it("should NOT mark a temporary redirect as an error", function () {
      return expect(urltils.isError(config, 303)).false;
    });

    it("should mark a bad request as an error", function () {
      return expect(urltils.isError(config, 400)).true;
    });

    it("should mark an unauthorized request as an error", function () {
      return expect(urltils.isError(config, 401)).true;
    });

    it("should mark a 'payment required' request as an error", function () {
      return expect(urltils.isError(config, 402)).true;
    });

    it("should mark a forbidden request as an error", function () {
      return expect(urltils.isError(config, 403)).true;
    });

    it("should mark a not found request as an error", function () {
      return expect(urltils.isError(config, 404)).true;
    });

    it("should mark a request with too long a URI as an error", function () {
      return expect(urltils.isError(config, 414)).true;
    });

    it("should mark a method not allowed request as an error", function () {
      return expect(urltils.isError(config, 405)).true;
    });

    it("should mark a request with unacceptable types as an error", function () {
      return expect(urltils.isError(config, 406)).true;
    });

    it("should mark a request requiring proxy auth as an error", function () {
      return expect(urltils.isError(config, 407)).true;
    });

    it("should mark a timed out request as an error", function () {
      return expect(urltils.isError(config, 408)).true;
    });

    it("should mark a conflicted request as an error", function () {
      return expect(urltils.isError(config, 409)).true;
    });

    it("should mark a request for a disappeared resource as an error", function () {
      return expect(urltils.isError(config, 410)).true;
    });

    it("should mark a request with a missing length as an error", function () {
      return expect(urltils.isError(config, 411)).true;
    });

    it("should mark a request with a failed precondition as an error", function () {
      return expect(urltils.isError(config, 412)).true;
    });

    it("should mark a too-large request as an error", function () {
      return expect(urltils.isError(config, 413)).true;
    });

    it("should mark a request for an unsupported media type as an error", function () {
      return expect(urltils.isError(config, 415)).true;
    });

    it("should mark a request for an unsatisfiable range as an error", function () {
      return expect(urltils.isError(config, 416)).true;
    });

    it("should mark a request with a failed expectation as an error", function () {
      return expect(urltils.isError(config, 417)).true;
    });

    it("should mark a request asserting teapotness as an error", function () {
      return expect(urltils.isError(config, 418)).true;
    });

    it("should mark a request with timed-out auth as an error", function () {
      return expect(urltils.isError(config, 419)).true;
    });

    it("should mark a request for enhanced calm (brah) as an error", function () {
      return expect(urltils.isError(config, 420)).true;
    });
  });
});
