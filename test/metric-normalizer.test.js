'use strict';

var path = require('path')
  , chai = require('chai')
  , expect = chai.expect
  , Normalizer = require(path.join(__dirname, '..', 'lib', 'metrics', 'normalizer'))
  ;

describe ("MetricNormalizer", function () {
  // captured from staging-collector-1.newrelic.com on 2012-08-29
  var rules =
    [{each_segment : false, eval_order : 0, terminate_chain : true,
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
      replace_all : false, ignore : false, replacement : '\\1/.*\\2'}];

  var samples = {url_rules : rules};

  it("shouldn't throw when instantiated without any rules", function () {
    expect(function () { var normalizer = new Normalizer(); });
  });

  it("shouldn't throw when instantiated with a full set of rules", function () {
    expect(function () { var normalizer = new Normalizer(samples); });
  });

  it("should normalize a JPEGgy URL", function () {
    var normalizer = new Normalizer(samples);
    var normalized = normalizer.normalizeUrl('/excessivity.jpeg');
    expect(normalized).equal('/*.jpeg');
  });

  it("should normalize a JPGgy URL", function () {
    var normalizer = new Normalizer(samples);
    var normalized = normalizer.normalizeUrl('/excessivity.jpg');
    expect(normalized).equal('/*.jpg');
  });

  it("should normalize a CSS URL", function () {
    var normalizer = new Normalizer(samples);
    var normalized = normalizer.normalizeUrl('/style.css');
    expect(normalized).equal('/*.css');
  });

  it("should apply rules by precedence");
  it("should terminate when indicated by rule");
  it("should use precedence to decide how to apply multiple rules");
});
