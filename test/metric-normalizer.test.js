'use strict';

var path       = require('path')
  , chai       = require('chai')
  , expect     = chai.expect
  , Normalizer = require(path.join(__dirname, '..', 'lib', 'metrics', 'normalizer'))
  ;

describe ("MetricNormalizer", function () {
  it("shouldn't throw when instantiated without any rules", function () {
    expect(function () { var normalizer = new Normalizer(); }).not.throws();
  });

  it("should normalize even without any rules set", function () {
    expect(function () {
      expect(new Normalizer().normalize('/sample')).eql({name : '/sample'});
    }).not.throws();
  });

  it("should normalize with an empty rule set", function () {
    expect(function () {
      var normalizer = new Normalizer();
      normalizer.load({url_rules : []});

      expect(normalizer.normalize('/sample')).eql({name : '/sample'});
    }).not.throws();
  });

  describe("with rules captured from the staging collector on 2012-08-29",
           function () {
    var sample = {
      url_rules : [
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
      ]
    };

    it("shouldn't throw when instantiated with a full set of rules", function () {
      expect(function () { var normalizer = new Normalizer(sample); }).not.throws();
    });

    it("should eliminate duplicate rules as part of loading them", function () {
      var reduced = [
        {eachSegment : false, precedence : 0, isTerminal : true,
         pattern: /^(test_match_nothing)$/,
         replaceAll : false, ignore : false, replacement : '$1'},
        {eachSegment : false, precedence : 0, isTerminal : true,
         pattern: /.*\\.(css|gif|ico|jpe?g|js|png|swf)$/,
         replaceAll : false, ignore : false, replacement : '/*.$1'},
        {eachSegment : true, precedence : 1, isTerminal : false,
         pattern: /^[0-9][0-9a-f_,.\-]*$/,
         replaceAll : false, ignore : false, replacement : '*'},
        {eachSegment : false, precedence : 2, isTerminal : false,
         pattern: /^(.*)\/[0-9][0-9a-f_,\-]*\\.([0-9a-z][0-9a-z]*)$/,
         replaceAll : false, ignore : false, replacement : '$1/.*$2'}
      ];

      var normalizer = new Normalizer(sample);
      expect(normalizer.rules).eql(reduced);
    });

    it("should normalize a JPEGgy URL", function () {
      expect(new Normalizer(sample).normalize('/excessivity.jpeg')).eql({
        name       : '/excessivity.jpeg',
        normalized : '/*.jpeg',
        terminal   : true
      });
    });

    it("should normalize a JPGgy URL", function () {
      expect(new Normalizer(sample).normalize('/excessivity.jpg')).eql({
        name       : '/excessivity.jpg',
        normalized : '/*.jpg',
        terminal   : true
      });
    });

    it("should normalize a CSS URL", function () {
      expect(new Normalizer(sample).normalize('/style.css')).eql({
        name       : '/style.css',
        normalized : '/*.css',
        terminal   : true
      });
    });
  });

  it("should correctly ignore a matching name", function () {
    var sample = {
      url_rules : [
        {each_segment : false, eval_order : 0, terminate_chain : true,
         match_expression : '^/long_polling$',
         replace_all : false, ignore : true, replacement : '*'}
      ]
    };

    expect(new Normalizer(sample).normalize('/long_polling')).eql({
      name     : '/long_polling',
      ignore   : true
    });
  });

  it("should apply rules by precedence", function () {
    var sample = {
      url_rules : [
        {each_segment : true, eval_order : 1, terminate_chain : false,
         match_expression : 'mochi',
         replace_all : false, ignore : false, replacement : 'millet'},
        {each_segment : false, eval_order : 0, terminate_chain : false,
         match_expression : '/rice$',
         replace_all : false, ignore : false, replacement : '/mochi'}
      ]
    };

    expect(new Normalizer(sample).normalize('/rice/is/not/rice')).eql({
      name       : '/rice/is/not/rice',
      normalized : '/rice/is/not/millet'
    });
  });

  it("should terminate when indicated by rule", function () {
    var sample = {
      url_rules : [
        {each_segment : true, eval_order : 1, terminate_chain : false,
         match_expression : 'mochi',
         replace_all : false, ignore : false, replacement : 'millet'},
        {each_segment : false, eval_order : 0, terminate_chain : true,
         match_expression : '/rice$',
         replace_all : false, ignore : false, replacement : '/mochi'}
      ]
    };

    expect(new Normalizer(sample).normalize('/rice/is/not/rice')).eql({
      name       : '/rice/is/not/rice',
      normalized : '/rice/is/not/mochi',
      terminal   : true
    });
  });
});
