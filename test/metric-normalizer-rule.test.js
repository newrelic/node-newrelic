'use strict';

var path = require('path')
  , chai = require('chai')
  , expect = chai.expect
  , Rule = require(path.join(__dirname, '..', 'lib', 'metrics', 'normalizer', 'rule'))
  ;

describe("NormalizerRule", function () {
  var rule;

  describe("with a very simple specification", function () {
    before(function () {
      // sample rule sent by staging collector 1 on 2012-08-29
      var sample = {
        "each_segment"     : false,
        "eval_order"       : 0,
        "terminate_chain"  : true,
        "match_expression" : '^(test_match_nothing)$',
        "replace_all"      : false,
        "ignore"           : false,
        "replacement"      : '\\1'
      };

      rule = new Rule(sample);
    });

    it("should know whether the rule terminates normalization", function () {
      expect(rule.isTerminal).equal(true);
    });

    it("should know its own precedence", function () {
      expect(rule.precedence).equal(0);
    });

    it("should correctly compile the included regexp", function () {
      expect(rule.matches('test_match_nothing')).equal(true);
      expect(rule.matches('a test_match_nothing')).equal(false);
      expect(rule.matches('test_match_nothin\'')).equal(false);
    });

    it("shouldn't throw if the regexp doesn't compile", function () {
      var whoops = {"match_expression" : '$[ad^'};
      var bad;
      expect(function () { bad = new Rule(whoops); }).not.throws();
      expect(bad.matches('')).equal(true);
    });

    it("should know if the regexp is applied to each 'segment' in the URL", function () {
      expect(rule.eachSegment).equal(false);
    });

    it("should know if the regexp replaces all instances in the URL", function () {
      expect(rule.replaceAll).equal(false);
    });

    it("should parse the replacement pattern", function () {
      expect(rule.replacement).equal('$1');
    });

    it("should know whether to ignore the URL", function () {
      expect(rule.ignore).equal(false);
    });

    it("should be able to take in a non-normalized URL and return it normalized", function () {
      expect(rule.apply('test_match_nothing')).equal('test_match_nothing');
    });
  });

  describe("with Saxon's patterns", function () {
    describe("including '^(?!account|application).*'", function () {
      beforeEach(function () {
        rule = new Rule({
          "each_segment"     : true,
          "match_expression" : "^(?!account|application).*",
          "replacement"      : "*"
        });
      });

      it("implies '/account/myacc/application/test' -> '/account/*/application/*'",
         function () {
        expect(rule.apply('/account/myacc/application/test'))
          .equal('/account/*/application/*');
      });

      it("implies '/oh/dude/account/myacc/application' -> '/*/*/account/*/application'",
         function () {
        expect(rule.apply('/oh/dude/account/myacc/application'))
          .equal('/*/*/account/*/application');
      });
    });

    describe("including '^(?!channel|download|popups|search|tap|user|related|admin|api|genres|notification).*'",
            function () {
      beforeEach(function () {
        rule = new Rule({
          "each_segment"     : true,
          "match_expression" : "^(?!channel|download|popups|search|tap|user|related|admin|api|genres|notification).*",
          "replacement"      : "*"
        });
      });

      it("implies '/tap/stuff/user/gfy77t/view' -> '/tap/*/user/*/*'",
         function () {
        expect(rule.apply('/tap/stuff/user/gfy77t/view'))
          .equal('/tap/*/user/*/*');
      });
    });
  });

  describe("with a more complex substitution rule", function () {
    before(function () {
      // sample rule sent by staging collector 1 on 2012-08-29
      var sample = {
        "each_segment"     : true,
        "eval_order"       : 1,
        "terminate_chain"  : false,
        "match_expression" : "^[0-9][0-9a-f_,.-]*$",
        "replace_all"      : false,
        "ignore"           : false,
        "replacement"      : "*"
      };

      rule = new Rule(sample);
    });

    it("should know whether the rule terminates normalization", function () {
      expect(rule.isTerminal).equal(false);
    });

    it("should know its own precedence", function () {
      expect(rule.precedence).equal(1);
    });

    it("should correctly compile the included regexp", function () {
      expect(rule.matches('/00dead_beef_00,b/hamburt')).equal(true);
      expect(rule.matches('a test_match_nothing')).equal(false);
      expect(rule.matches('/00 dead dad/nomatch')).equal(false);
    });

    it("should know if the regexp is applied to each 'segment' in the URL", function () {
      expect(rule.eachSegment).equal(true);
    });

    it("should know if the regexp replaces all instances in the URL", function () {
      expect(rule.replaceAll).equal(false);
    });

    it("should parse the replacement pattern", function () {
      expect(rule.replacement).equal('*');
    });

    it("should know whether to ignore the URL", function () {
      expect(rule.ignore).equal(false);
    });

    it("should be able to take in a non-normalized URL and return it normalized", function () {
      expect(rule.apply('/00dead_beef_00,b/hamburt')).equal('/*/hamburt');
    });
  });

  it("should replace all the instances of a pattern when so specified", function () {
    var sample = {
      "each_segment"     : false,
      "eval_order"       : 0,
      "terminate_chain"  : false,
      "match_expression" : "xXx",
      "replace_all"      : true,
      "ignore"           : false,
      "replacement"      : "y"
    };
    rule = new Rule(sample);

    expect(rule.pattern.global).equal(true);
    expect(rule.apply('/test/xXxxXx0xXxzxxxxXx')).equal('/test/yy0yzxxxy');
  });

  describe("when given an incomplete specification", function () {
    it("shouldn't throw (but it can log!)", function () {
      expect(function () { rule = new Rule(); }).not.throws();
    });

    it("should default to not applying the rule to each segment", function () {
      expect(new Rule().eachSegment).equal(false);
    });

    it("should default the rule's precedence to 0", function () {
      expect(new Rule().precedence).equal(0);
    });

    it("should default to not terminating rule evaluation", function () {
      expect(new Rule().isTerminal).equal(false);
    });

    it("should have a regexp that matches the empty string", function () {
      expect(new Rule().pattern).eql(/^$/);
    });

    it("should use the entire match as the replacement value", function () {
      expect(new Rule().replacement).equal('$0');
    });

    it("should default to not replacing all instances", function () {
      expect(new Rule().replaceAll).equal(false);
    });

    it("should default to not ignoring matching URLs", function () {
      expect(new Rule().ignore).equal(false);
    });

    it("should silently pass through the input if applied", function () {
      expect(new Rule().apply('sample/input')).equal('sample/input');
    });
  });
});
