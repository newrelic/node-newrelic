'use strict'

var chai = require('chai')
var Config = require('../../../lib/config')
var expect = chai.expect
var Normalizer = require('../../../lib/metrics/normalizer')
var semver = require('semver')


describe ("MetricNormalizer", function() {
  var normalizer

  beforeEach(function() {
    var config = {enforce_backstop: true}
    normalizer = new Normalizer(config, 'URL')
  })

  it("should throw when instantiated without config", function() {
    expect(function() {
      normalizer = new Normalizer()
    }).throws()
  })

  it("should throw when instantiated without type", function() {
    var config = {enforce_backstop: true}
    expect(function() {
      normalizer = new Normalizer(config)
    }).throws()
  })

  it("should normalize even without any rules set", function() {
    expect(function() {
      expect(normalizer.normalize('/sample')).to.have.property('value', 'NormalizedUri/*')
    }).not.throws()
  })

  it("should normalize with an empty rule set", function() {
    expect(function() {
      normalizer.load([])

      expect(normalizer.normalize('/sample')).to.have.property('value', 'NormalizedUri/*')
    }).not.throws()
  })

  describe("with rules captured from the staging collector on 2012-08-29", function() {
    beforeEach(function() {
      normalizer.load([
        {each_segment: false, eval_order: 0, terminate_chain: true,
         match_expression: '^(test_match_nothing)$',
         replace_all: false, ignore: false, replacement: '\\1'},
        {each_segment: false, eval_order: 0, terminate_chain: true,
         match_expression: '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
         replace_all: false, ignore: false, replacement: '/*.\\1'},
        {each_segment: false, eval_order: 0, terminate_chain: true,
         match_expression: '^(test_match_nothing)$',
         replace_all: false, ignore: false, replacement: '\\1'},
        {each_segment: false, eval_order: 0, terminate_chain: true,
         match_expression: '^(test_match_nothing)$',
         replace_all: false, ignore: false, replacement: '\\1'},
        {each_segment: false, eval_order: 0, terminate_chain: true,
         match_expression: '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
         replace_all: false, ignore: false, replacement: '/*.\\1'},
        {each_segment: false, eval_order: 0, terminate_chain: true,
         match_expression: '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
         replace_all: false, ignore: false, replacement: '/*.\\1'},
        {each_segment: true, eval_order: 1, terminate_chain: false,
         match_expression: '^[0-9][0-9a-f_,.-]*$',
         replace_all: false, ignore: false, replacement: '*'},
        {each_segment: true, eval_order: 1, terminate_chain: false,
         match_expression: '^[0-9][0-9a-f_,.-]*$',
         replace_all: false, ignore: false, replacement: '*'},
        {each_segment: true, eval_order: 1, terminate_chain: false,
         match_expression: '^[0-9][0-9a-f_,.-]*$',
         replace_all: false, ignore: false, replacement: '*'},
        {each_segment: false, eval_order: 2, terminate_chain: false,
         match_expression: '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
         replace_all: false, ignore: false, replacement: '\\1/.*\\2'},
        {each_segment: false, eval_order: 2, terminate_chain: false,
         match_expression: '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
         replace_all: false, ignore: false, replacement: '\\1/.*\\2'},
        {each_segment: false, eval_order: 2, terminate_chain: false,
         match_expression: '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
         replace_all: false, ignore: false, replacement: '\\1/.*\\2'}
      ])
    })

    it("should eliminate duplicate rules as part of loading them", function() {
      var patternWithSlash
      if (semver.satisfies(process.versions.node, '>=1.0.0')) {
        patternWithSlash = '^(.*)\\/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$'
      } else {
        patternWithSlash = '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$'
      }
      var reduced = [
        {eachSegment: false, precedence: 0, isTerminal: true,
         replacement: '$1', replaceAll: false, ignore: false,
         pattern: '^(test_match_nothing)$'},
        {eachSegment: false, precedence: 0, isTerminal: true,
         replacement: '/*.$1', replaceAll: false, ignore: false,
         pattern: '.*\\.(css|gif|ico|jpe?g|js|png|swf)$'},
        {eachSegment: true, precedence: 1, isTerminal: false,
         replacement: '*', replaceAll: false, ignore: false,
         pattern: '^[0-9][0-9a-f_,.-]*$'},
        {eachSegment: false, precedence: 2, isTerminal: false,
         replacement: '$1/.*$2', replaceAll: false, ignore: false,
         pattern: patternWithSlash}
      ]

      expect(normalizer.rules.map(function cb_map(r) {
        return r.toJSON()
      })).eql(reduced)
    })

    it("should normalize a JPEGgy URL", function() {
      expect(normalizer.normalize('/excessivity.jpeg'))
        .to.have.property('value', 'NormalizedUri/*.jpeg')
    })

    it("should normalize a JPGgy URL", function() {
      expect(normalizer.normalize('/excessivity.jpg'))
        .to.have.property('value', 'NormalizedUri/*.jpg')
    })

    it("should normalize a CSS URL", function() {
      expect(normalizer.normalize('/style.css'))
        .to.have.property('value', 'NormalizedUri/*.css')
    })

    it('should drop old rules when reloading', function() {
      var newRule = {
        each_segment: false,
        eval_order: 0,
        terminate_chain: true,
        match_expression: '^(new rule)$',
        replace_all: false,
        ignore: false,
        replacement: '\\1'
      }
      normalizer.load([newRule])

      var expected = {
        eachSegment: false,
        precedence: 0,
        isTerminal: true,
        pattern: '^(new rule)$',
        replaceAll: false,
        ignore: false,
        replacement: '$1'
      }
      expect(normalizer.rules.map(function cb_map(r) {
        return r.toJSON()
      })).eql([expected])
    })
  })

  it("should ignore a matching name", function() {
    normalizer.load([
      {each_segment: false, eval_order: 0, terminate_chain: true,
       match_expression: '^/long_polling$',
       replace_all: false, ignore: true, replacement: '*'}
    ])

    expect(normalizer.normalize('/long_polling')).to.have.property('ignore', true)
  })

  it("should apply rules by precedence", function() {
    normalizer.load([
      {each_segment: true, eval_order: 1, terminate_chain: false,
       match_expression: 'mochi',
       replace_all: false, ignore: false, replacement: 'millet'},
      {each_segment: false, eval_order: 0, terminate_chain: false,
       match_expression: '/rice$',
       replace_all: false, ignore: false, replacement: '/mochi'}
    ])

    expect(normalizer.normalize('/rice/is/not/rice'))
      .to.have.property('value', 'NormalizedUri/rice/is/not/millet')
  })

  it("should terminate when indicated by rule", function() {
    normalizer.load([
      {each_segment: true, eval_order: 1, terminate_chain: false,
       match_expression: 'mochi',
       replace_all: false, ignore: false, replacement: 'millet'},
      {each_segment: false, eval_order: 0, terminate_chain: true,
       match_expression: '/rice$',
       replace_all: false, ignore: false, replacement: '/mochi'}
    ])

    expect(normalizer.normalize('/rice/is/not/rice'))
      .to.have.property('value', 'NormalizedUri/rice/is/not/mochi')
  })

  describe("when calling addSimple", function () {
    it("won't crash with no parameters", function () {
      expect(function () { normalizer.addSimple(); }).not.throws()
    })

    it("won't crash when name isn't passed", function () {
      expect(function () { normalizer.addSimple('^t'); }).not.throws()
    })

    it("will ignore matches when name isn't passed", function () {
      normalizer.addSimple('^t')
      expect(normalizer.rules[0].ignore).equal(true)
    })

    it("will create rename rules that work properly", function() {
      normalizer.addSimple('^/t(.*)$', '/w$1')
      expect(normalizer.normalize('/test'))
        .to.have.property('value', 'NormalizedUri/west')
    })
  })

  describe('when loading from config', function() {
    var config = null

    beforeEach(function() {
      config = new Config({
        rules: {
          name: [
            {pattern: '^first$',  name: 'first',  precedence: 500},
            {pattern: '^second$', name: 'second', precedence: 500},
            {pattern: '^third$',  name: 'third',  precedence: 100},
            {pattern: '^fourth$', name: 'fourth', precedence: 500}
          ]
        },
      })

      normalizer = new Normalizer(config, 'URL')
    })

    afterEach(function() {
      config = null
      normalizer = null
    })

    describe('with feature flag reverse_naming_rules', function() {
      describe('set to true (default)', function() {
        beforeEach(function() {
          normalizer.loadFromConfig()
        })

        it('should respect precedence', function() {
          expect(normalizer.rules[0]).to.have.property('replacement', 'third')
        })

        it('should have the rules in reverse order', function() {
          expect(normalizer.rules[0]).to.have.property('replacement', 'third')
          expect(normalizer.rules[1]).to.have.property('replacement', 'fourth')
          expect(normalizer.rules[2]).to.have.property('replacement', 'second')
          expect(normalizer.rules[3]).to.have.property('replacement', 'first')
        })
      })

      describe('set to false', function() {
        beforeEach(function() {
          config.feature_flag = {reverse_naming_rules: false}
          normalizer.loadFromConfig()
        })

        it('should respect precedence', function() {
          expect(normalizer.rules[0]).to.have.property('replacement', 'third')
        })

        it('should have the rules in forward order', function() {
          expect(normalizer.rules[0]).to.have.property('replacement', 'third')
          expect(normalizer.rules[1]).to.have.property('replacement', 'first')
          expect(normalizer.rules[2]).to.have.property('replacement', 'second')
          expect(normalizer.rules[3]).to.have.property('replacement', 'fourth')
        })
      })
    })
  })
})
