/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const Config = require('../../../lib/config')
const Normalizer = require('../../../lib/metrics/normalizer')

const stagingRules = require('./staging-rules')
function beforeEach(t) {
  const config = { enforce_backstop: true }
  t.context.normalizer = new Normalizer(config, 'URL')
}

tap.test('MetricNormalizer', function (t) {
  t.autoend()
  t.test('normalize', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.test('should throw when instantiated without config', function (t) {
      t.throws(function () {
        // eslint-disable-next-line no-new
        new Normalizer()
      })
      t.end()
    })

    t.test('should throw when instantiated without type', function (t) {
      const config = { enforce_backstop: true }
      t.throws(function () {
        // eslint-disable-next-line no-new
        new Normalizer(config)
      })
      t.end()
    })

    t.test('should normalize even without any rules set', function (t) {
      const { normalizer } = t.context
      t.equal(normalizer.normalize('/sample').value, 'NormalizedUri/*')
      t.end()
    })

    t.test('should normalize with an empty rule set', function (t) {
      const { normalizer } = t.context
      normalizer.load([])

      t.equal(normalizer.normalize('/sample').value, 'NormalizedUri/*')
      t.end()
    })

    t.test('should ignore a matching name', function (t) {
      const { normalizer } = t.context
      normalizer.load([
        {
          each_segment: false,
          eval_order: 0,
          terminate_chain: true,
          match_expression: '^/long_polling$',
          replace_all: false,
          ignore: true,
          replacement: '*'
        }
      ])

      t.equal(normalizer.normalize('/long_polling').ignore, true)
      t.end()
    })

    t.test('should apply rules by precedence', function (t) {
      const { normalizer } = t.context
      normalizer.load([
        {
          each_segment: true,
          eval_order: 1,
          terminate_chain: false,
          match_expression: 'mochi',
          replace_all: false,
          ignore: false,
          replacement: 'millet'
        },
        {
          each_segment: false,
          eval_order: 0,
          terminate_chain: false,
          match_expression: '/rice$',
          replace_all: false,
          ignore: false,
          replacement: '/mochi'
        }
      ])

      t.equal(normalizer.normalize('/rice/is/not/rice').value, 'NormalizedUri/rice/is/not/millet')
      t.end()
    })

    t.test('should terminate when indicated by rule', function (t) {
      const { normalizer } = t.context
      normalizer.load([
        {
          each_segment: true,
          eval_order: 1,
          terminate_chain: false,
          match_expression: 'mochi',
          replace_all: false,
          ignore: false,
          replacement: 'millet'
        },
        {
          each_segment: false,
          eval_order: 0,
          terminate_chain: true,
          match_expression: '/rice$',
          replace_all: false,
          ignore: false,
          replacement: '/mochi'
        }
      ])

      t.equal(normalizer.normalize('/rice/is/not/rice').value, 'NormalizedUri/rice/is/not/mochi')
      t.end()
    })
  })

  t.test('with rules captured from the staging collector on 2012-08-29', function (t) {
    t.autoend()
    t.beforeEach(function (t) {
      beforeEach(t)
      const { normalizer } = t.context
      normalizer.load(stagingRules)
    })

    t.test('should eliminate duplicate rules as part of loading them', function (t) {
      const { normalizer } = t.context
      const patternWithSlash = '^(.*)\\/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$'
      const reduced = [
        {
          eachSegment: false,
          precedence: 0,
          isTerminal: true,
          replacement: '$1',
          replaceAll: false,
          ignore: false,
          pattern: '^(test_match_nothing)$'
        },
        {
          eachSegment: false,
          precedence: 0,
          isTerminal: true,
          replacement: '/*.$1',
          replaceAll: false,
          ignore: false,
          pattern: '.*\\.(css|gif|ico|jpe?g|js|png|swf)$'
        },
        {
          eachSegment: true,
          precedence: 1,
          isTerminal: false,
          replacement: '*',
          replaceAll: false,
          ignore: false,
          pattern: '^[0-9][0-9a-f_,.-]*$'
        },
        {
          eachSegment: false,
          precedence: 2,
          isTerminal: false,
          replacement: '$1/.*$2',
          replaceAll: false,
          ignore: false,
          pattern: patternWithSlash
        }
      ]

      t.same(
        normalizer.rules.map((r) => {
          return r.toJSON()
        }),
        reduced
      )
      t.end()
    })

    t.test('should normalize a JPEGgy URL', function (t) {
      const { normalizer } = t.context
      t.equal(normalizer.normalize('/excessivity.jpeg').value, 'NormalizedUri/*.jpeg')
      t.end()
    })

    t.test('should normalize a JPGgy URL', function (t) {
      const { normalizer } = t.context
      t.equal(normalizer.normalize('/excessivity.jpg').value, 'NormalizedUri/*.jpg')
      t.end()
    })

    t.test('should normalize a CSS URL', function (t) {
      const { normalizer } = t.context
      t.equal(normalizer.normalize('/style.css').value, 'NormalizedUri/*.css')
      t.end()
    })

    t.test('should drop old rules when reloading', function (t) {
      const { normalizer } = t.context
      const newRule = {
        each_segment: false,
        eval_order: 0,
        terminate_chain: true,
        match_expression: '^(new rule)$',
        replace_all: false,
        ignore: false,
        replacement: '\\1'
      }
      normalizer.load([newRule])

      const expected = {
        eachSegment: false,
        precedence: 0,
        isTerminal: true,
        pattern: '^(new rule)$',
        replaceAll: false,
        ignore: false,
        replacement: '$1'
      }
      t.same(
        normalizer.rules.map((r) => {
          return r.toJSON()
        }),
        [expected]
      )
      t.end()
    })
  })

  t.test('when calling addSimple', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.test("won't crash with no parameters", function (t) {
      const { normalizer } = t.context
      t.doesNotThrow(function () {
        normalizer.addSimple()
      })
      t.end()
    })

    t.test("won't crash when name isn't passed", function (t) {
      const { normalizer } = t.context
      t.doesNotThrow(function () {
        normalizer.addSimple('^t')
      })
      t.end()
    })

    t.test("will ignore matches when name isn't passed", function (t) {
      const { normalizer } = t.context
      normalizer.addSimple('^t')
      t.equal(normalizer.rules[0].ignore, true)
      t.end()
    })

    t.test('will create rename rules that work properly', function (t) {
      const { normalizer } = t.context
      normalizer.addSimple('^/t(.*)$', '/w$1')
      t.equal(normalizer.normalize('/test').value, 'NormalizedUri/west')
      t.end()
    })
  })

  t.test('when loading from config', function (t) {
    t.autoend()
    t.beforeEach(function (t) {
      t.context.config = new Config({
        rules: {
          name: [
            { pattern: '^first$', name: 'first', precedence: 500 },
            { pattern: '^second$', name: 'second', precedence: 500 },
            { pattern: '^third$', name: 'third', precedence: 100 },
            { pattern: '^fourth$', name: 'fourth', precedence: 500 }
          ]
        }
      })

      t.context.normalizer = new Normalizer(t.context.config, 'URL')
    })

    t.afterEach(function (t) {
      t.context.config = null
      t.context.normalizer = null
    })

    t.test('with feature flag reverse_naming_rules set to true', function (t) {
      const { config, normalizer } = t.context
      config.feature_flag = { reverse_naming_rules: true }
      normalizer.loadFromConfig()
      t.equal(normalizer.rules[1].replacement, 'third')
      t.equal(normalizer.rules[2].replacement, 'fourth')
      t.equal(normalizer.rules[3].replacement, 'second')
      t.equal(normalizer.rules[4].replacement, 'first')
      t.end()
    })

    t.test('with feature flag reverse_naming_rules set to false (default)', function (t) {
      const { normalizer } = t.context
      normalizer.loadFromConfig()
      t.equal(normalizer.rules[1].replacement, 'third')
      t.equal(normalizer.rules[2].replacement, 'first')
      t.equal(normalizer.rules[3].replacement, 'second')
      t.equal(normalizer.rules[4].replacement, 'fourth')
      t.end()
    })
  })
})
