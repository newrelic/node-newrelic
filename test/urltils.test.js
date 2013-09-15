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
    it("should NOT mark an OK request as an error", function () {
      return expect(urltils.isError(200)).false;
    });

    it("should NOT mark a permanent redirect as an error", function () {
      return expect(urltils.isError(301)).false;
    });

    it("should NOT mark a temporary redirect as an error", function () {
      return expect(urltils.isError(303)).false;
    });

    it("should mark a bad request as an error", function () {
      return expect(urltils.isError(400)).true;
    });

    it("should mark an unauthorized request as an error", function () {
      return expect(urltils.isError(401)).true;
    });

    it("should mark a 'payment required' request as an error", function () {
      return expect(urltils.isError(402)).true;
    });

    it("should mark a forbidden request as an error", function () {
      return expect(urltils.isError(403)).true;
    });

    it("should mark a not found request as an error", function () {
      return expect(urltils.isError(404)).true;
    });

    it("should mark a request with too long a URI as an error", function () {
      return expect(urltils.isError(414)).true;
    });

    it("should mark a method not allowed request as an error", function () {
      return expect(urltils.isError(405)).true;
    });

    it("should mark a request with unacceptable types as an error", function () {
      return expect(urltils.isError(406)).true;
    });

    it("should mark a request requiring proxy auth as an error", function () {
      return expect(urltils.isError(407)).true;
    });

    it("should mark a timed out request as an error", function () {
      return expect(urltils.isError(408)).true;
    });

    it("should mark a conflicted request as an error", function () {
      return expect(urltils.isError(409)).true;
    });

    it("should mark a request for a disappeared resource as an error", function () {
      return expect(urltils.isError(410)).true;
    });

    it("should mark a request with a missing length as an error", function () {
      return expect(urltils.isError(411)).true;
    });

    it("should mark a request with a failed precondition as an error", function () {
      return expect(urltils.isError(412)).true;
    });

    it("should mark a too-large request as an error", function () {
      return expect(urltils.isError(413)).true;
    });

    it("should mark a request for an unsupported media type as an error", function () {
      return expect(urltils.isError(415)).true;
    });

    it("should mark a request for an unsatisfiable range as an error", function () {
      return expect(urltils.isError(416)).true;
    });

    it("should mark a request with a failed expectation as an error", function () {
      return expect(urltils.isError(417)).true;
    });

    it("should mark a request asserting teapotness as an error", function () {
      return expect(urltils.isError(418)).true;
    });

    it("should mark a request with timed-out auth as an error", function () {
      return expect(urltils.isError(419)).true;
    });

    it("should mark a request for enhanced calm (brah) as an error", function () {
      return expect(urltils.isError(420)).true;
    });
  });
});
