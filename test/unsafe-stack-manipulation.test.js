var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , getRawStack  = require(path.join(__dirname, '..', 'lib', 'util', 'raw-stack'))
  , callstack    = require(path.join(__dirname, '..', 'lib', 'util', 'callstack'))
  ;

describe("when manipulating the call stack", function () {
  var NR_PROPNAME = "__NR_transaction";
  var NR_PROPVALUE = "yes";

  describe("and you don't care about strict mode and abusing arguments.callee", function () {
    it("should be able to find the caller", function () {
      expect(callstack.findCaller(0)).equal(arguments.callee);
    });

    it("should be able to find the caller by default", function () {
      expect((function () { return callstack.findCaller(); }())).equal(arguments.callee);
    });

    it("should be able to find the caller", function () {
      var caller = function () {
        (function () {
          var parentFunction = arguments.callee.caller;
          expect(parentFunction).equal(caller);
        }());
      };

      caller();
    });

    it("should be able to match results given by getRawStack", function () {
      var caller = function () {
        (function () {
          var thisFunction    = arguments.callee;
          var callingFunction = thisFunction.caller;

          var frames = getRawStack();
          expect(frames[0].fun).equal(thisFunction);
          expect(frames[1].fun).equal(callingFunction);
        }());
      };

      caller();
    });
  });

  describe("when using stacktraces to safely (and slowly) traverse the call chain", function () {
    'use strict';

    it("should find the caller", function () {
      var caller = function () {
        (function () {
          var parentFunction = callstack.findCaller();
          expect(parentFunction).equal(caller);
        }());
      };

      caller();
    });

    it("should use findCaller to match results given by getRawStack", function () {
      var caller = function () {
        (function () {
          var thisFunction    = callstack.findCaller(0);
          var callingFunction = callstack.findCaller();

          var frames = getRawStack();
          expect(frames[0].fun).equal(thisFunction);
          expect(frames[1].fun).equal(callingFunction);
        }());
      };

      caller();
    });

    it("should annotate the call stack", function () {
      callstack.annotateCaller(NR_PROPNAME, NR_PROPVALUE);

      expect(callstack.findCaller(0)[NR_PROPNAME]).equal(NR_PROPVALUE);
    });

    it("should find the annotation later", function () {
      expect(callstack.findAnnotation(NR_PROPNAME)).equal(undefined);
      callstack.annotateCaller(NR_PROPNAME, NR_PROPVALUE);
      expect(callstack.findAnnotation(NR_PROPNAME)).equal(NR_PROPVALUE);
    });

    it("should find the annotation even from a deep call stack", function () {
      expect(callstack.findAnnotation(NR_PROPNAME)).equal(undefined);
      callstack.annotateCaller(NR_PROPNAME, NR_PROPVALUE);
      (function () {
        (function () {
          (function () {
            (function () {
              (function () {
                (function () {
                  (function () {
                    (function () {
                      expect(callstack.findAnnotation(NR_PROPNAME)).equal(NR_PROPVALUE);
                    }());
                  }());
                }());
              }());
            }());
          }());
        }());
      }());
    });
  });
});
