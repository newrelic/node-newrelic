'use strict';

var path       = require('path')
  , chai       = require('chai')
  , expect     = chai.expect
  , Normalizer = require(path.join(__dirname, '..', 'lib', 'metrics', 'normalizer'))
  ;

describe ("MetricNormalizer", function () {
  var normalizer;

  beforeEach(function () {
    var config = {enforce_backstop : true};
    normalizer = new Normalizer(config, 'URL');
  });

  it("should throw when instantiated without config", function () {
    expect(function () { normalizer = new Normalizer(); }).throws();
  });

  it("should throw when instantiated without type", function () {
    var config = {enforce_backstop : true};
    expect(function () { normalizer = new Normalizer(config); }).throws();
  });

  it("should normalize even without any rules set", function () {
    expect(function () {
      expect(normalizer.normalize('/sample')).equal('NormalizedUri/*');
    }).not.throws();
  });

  it("should normalize with an empty rule set", function () {
    expect(function () {
      normalizer.load([]);

      expect(normalizer.normalize('/sample')).equal('NormalizedUri/*');
    }).not.throws();
  });

  describe("with rules captured from the staging collector on 2012-08-29",
           function () {
    beforeEach(function () {
      normalizer.load([
        {each_segment : false, eval_order : 0, terminate_chain : true,
         match_expression : '^(test_match_nothing)$',
         replace_all : false, ignore : false, replacement : '\\1'},
        {each_segment : false, eval_order : 0, terminate_chain : true,
         match_expression : '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
         replace_all : false, ignore : false, replacement : '/*.\\1'},
        {each_segment : false, eval_order : 0, terminate_chain : true,
         match_expression : '^(test_match_nothing)$',
         replace_all : false, ignore : false, replacement : '\\1'},
        {each_segment : false, eval_order : 0, terminate_chain : true,
         match_expression : '^(test_match_nothing)$',
         replace_all : false, ignore : false, replacement : '\\1'},
        {each_segment : false, eval_order : 0, terminate_chain : true,
         match_expression : '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
         replace_all : false, ignore : false, replacement : '/*.\\1'},
        {each_segment : false, eval_order : 0, terminate_chain : true,
         match_expression : '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
         replace_all : false, ignore : false, replacement : '/*.\\1'},
        {each_segment : true, eval_order : 1, terminate_chain : false,
         match_expression : '^[0-9][0-9a-f_,.-]*$',
         replace_all : false, ignore : false, replacement : '*'},
        {each_segment : true, eval_order : 1, terminate_chain : false,
         match_expression : '^[0-9][0-9a-f_,.-]*$',
         replace_all : false, ignore : false, replacement : '*'},
        {each_segment : true, eval_order : 1, terminate_chain : false,
         match_expression : '^[0-9][0-9a-f_,.-]*$',
         replace_all : false, ignore : false, replacement : '*'},
        {each_segment : false, eval_order : 2, terminate_chain : false,
         match_expression : '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
         replace_all : false, ignore : false, replacement : '\\1/.*\\2'},
        {each_segment : false, eval_order : 2, terminate_chain : false,
         match_expression : '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
         replace_all : false, ignore : false, replacement : '\\1/.*\\2'},
        {each_segment : false, eval_order : 2, terminate_chain : false,
         match_expression : '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
         replace_all : false, ignore : false, replacement : '\\1/.*\\2'}
      ]);
    });

    it("should eliminate duplicate rules as part of loading them", function () {
      var reduced = [
        {eachSegment : false, precedence : 0, isTerminal : true,
         replacement : '$1', replaceAll : false, ignore : false,
         pattern: '^(test_match_nothing)$'},
        {eachSegment : false, precedence : 0, isTerminal : true,
         replacement : '/*.$1', replaceAll : false, ignore : false,
         pattern: '.*\\.(css|gif|ico|jpe?g|js|png|swf)$'},
        {eachSegment : true, precedence : 1, isTerminal : false,
         replacement : '*', replaceAll : false, ignore : false,
         pattern: '^[0-9][0-9a-f_,.-]*$'},
        {eachSegment : false, precedence : 2, isTerminal : false,
         replacement : '$1/.*$2', replaceAll : false, ignore : false,
         pattern: '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$'}
      ];

      expect(normalizer.rules.map(function (r) { return r.toJSON(); })).eql(reduced);
    });

    it("should normalize a JPEGgy URL", function () {
      expect(normalizer.normalize('/excessivity.jpeg')).equal('NormalizedUri/*.jpeg');
    });

    it("should normalize a JPGgy URL", function () {
      expect(normalizer.normalize('/excessivity.jpg')).equal('NormalizedUri/*.jpg');
    });

    it("should normalize a CSS URL", function () {
      expect(normalizer.normalize('/style.css')).eql('NormalizedUri/*.css');
    });
  });

  it("should ignore a matching name", function () {
    normalizer.load([
      {each_segment : false, eval_order : 0, terminate_chain : true,
       match_expression : '^/long_polling$',
       replace_all : false, ignore : true, replacement : '*'}
    ]);

    expect(normalizer.isIgnored('/long_polling')).equal(true);
  });

  it("should apply rules by precedence", function () {
    normalizer.load([
      {each_segment : true, eval_order : 1, terminate_chain : false,
       match_expression : 'mochi',
       replace_all : false, ignore : false, replacement : 'millet'},
      {each_segment : false, eval_order : 0, terminate_chain : false,
       match_expression : '/rice$',
       replace_all : false, ignore : false, replacement : '/mochi'}
    ]);

    expect(normalizer.normalize('/rice/is/not/rice'))
      .equal('NormalizedUri/rice/is/not/millet');
  });

  it("should terminate when indicated by rule", function () {
    normalizer.load([
      {each_segment : true, eval_order : 1, terminate_chain : false,
       match_expression : 'mochi',
       replace_all : false, ignore : false, replacement : 'millet'},
      {each_segment : false, eval_order : 0, terminate_chain : true,
       match_expression : '/rice$',
       replace_all : false, ignore : false, replacement : '/mochi'}
    ]);

    expect(normalizer.normalize('/rice/is/not/rice'))
      .equal('NormalizedUri/rice/is/not/mochi');
  });

  describe("when calling addSimple", function () {
    it("won't crash with no parameters", function () {
      expect(function () { normalizer.addSimple(); }).not.throws();
    });

    it("won't crash when name isn't passed", function () {
      expect(function () { normalizer.addSimple('^t'); }).not.throws();
    });

    it("will ignore matches when name isn't passed", function () {
      normalizer.addSimple('^t');
      expect(normalizer.rules[0].ignore).equal(true);
    });

    it("will create rename rules that work properly", function () {
      normalizer.addSimple('^/t(.*)$', '/w$1');
      expect(normalizer.normalize('/test')).equal('NormalizedUri/west');
    });
  });
});
