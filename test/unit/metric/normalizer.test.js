/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const Config = require('../../../lib/config')
const Normalizer = require('../../../lib/metrics/normalizer')

const stagingRules = require('./staging-rules')
function beforeEach(ctx) {
  ctx.nr = {}
  const config = { enforce_backstop: true }
  ctx.nr.normalizer = new Normalizer(config, 'URL')
}

test('MetricNormalizer', async function (t) {
  await t.test('normalize', async (t) => {
    t.beforeEach(beforeEach)
    await t.test('should throw when instantiated without config', function () {
      assert.throws(function () {
        // eslint-disable-next-line no-new
        new Normalizer()
      })
    })

    await t.test('should throw when instantiated without type', function () {
      const config = { enforce_backstop: true }
      assert.throws(function () {
        // eslint-disable-next-line no-new
        new Normalizer(config)
      })
    })

    await t.test('should normalize even without any rules set', function (t) {
      const { normalizer } = t.nr
      assert.equal(normalizer.normalize('/sample').value, 'NormalizedUri/*')
    })

    await t.test('should normalize with an empty rule set', function (t) {
      const { normalizer } = t.nr
      normalizer.load([])

      assert.equal(normalizer.normalize('/sample').value, 'NormalizedUri/*')
    })

    await t.test('should ignore a matching name', function (t) {
      const { normalizer } = t.nr
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

      assert.equal(normalizer.normalize('/long_polling').ignore, true)
    })

    await t.test('should apply rules by precedence', function (t) {
      const { normalizer } = t.nr
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

      assert.equal(
        normalizer.normalize('/rice/is/not/rice').value,
        'NormalizedUri/rice/is/not/millet'
      )
    })

    await t.test('should terminate when indicated by rule', function (t) {
      const { normalizer } = t.nr
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

      assert.equal(
        normalizer.normalize('/rice/is/not/rice').value,
        'NormalizedUri/rice/is/not/mochi'
      )
    })
  })

  await t.test('with rules captured from the staging collector on 2012-08-29', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { normalizer } = ctx.nr
      normalizer.load(stagingRules)
    })

    await t.test('should eliminate duplicate rules as part of loading them', function (t) {
      const { normalizer } = t.nr
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

      assert.deepEqual(
        normalizer.rules.map((r) => {
          return r.toJSON()
        }),
        reduced
      )
    })

    await t.test('should normalize a JPEGgy URL', function (t) {
      const { normalizer } = t.nr
      assert.equal(normalizer.normalize('/excessivity.jpeg').value, 'NormalizedUri/*.jpeg')
    })

    await t.test('should normalize a JPGgy URL', function (t) {
      const { normalizer } = t.nr
      assert.equal(normalizer.normalize('/excessivity.jpg').value, 'NormalizedUri/*.jpg')
    })

    await t.test('should normalize a CSS URL', function (t) {
      const { normalizer } = t.nr
      assert.equal(normalizer.normalize('/style.css').value, 'NormalizedUri/*.css')
    })

    await t.test('should drop old rules when reloading', function (t) {
      const { normalizer } = t.nr
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
      assert.deepEqual(
        normalizer.rules.map((r) => {
          return r.toJSON()
        }),
        [expected]
      )
    })
  })

  await t.test('when calling addSimple', async function (t) {
    t.beforeEach(beforeEach)
    await t.test("won't crash with no parameters", function (t) {
      const { normalizer } = t.nr
      assert.doesNotThrow(function () {
        normalizer.addSimple()
      })
    })

    await t.test("won't crash when name isn't passed", function (t) {
      const { normalizer } = t.nr
      assert.doesNotThrow(function () {
        normalizer.addSimple('^t')
      })
    })

    await t.test("will ignore matches when name isn't passed", function (t) {
      const { normalizer } = t.nr
      normalizer.addSimple('^t')
      assert.equal(normalizer.rules[0].ignore, true)
    })

    await t.test('will create rename rules that work properly', function (t) {
      const { normalizer } = t.nr
      normalizer.addSimple('^/t(.*)$', '/w$1')
      assert.equal(normalizer.normalize('/test').value, 'NormalizedUri/west')
    })
  })

  await t.test('when loading from config', async function (t) {
    t.beforeEach(function (ctx) {
      ctx.nr = {}
      ctx.nr.config = new Config({
        rules: {
          name: [
            { pattern: '^first$', name: 'first', precedence: 500 },
            { pattern: '^second$', name: 'second', precedence: 500 },
            { pattern: '^third$', name: 'third', precedence: 100 },
            { pattern: '^fourth$', name: 'fourth', precedence: 500 }
          ]
        }
      })

      ctx.nr.normalizer = new Normalizer(ctx.nr.config, 'URL')
    })

    t.afterEach(function (ctx) {
      ctx.nr.config = null
      ctx.nr.normalizer = null
    })

    await t.test('with feature flag reverse_naming_rules set to true', function (t) {
      const { config, normalizer } = t.nr
      config.feature_flag = { reverse_naming_rules: true }
      normalizer.loadFromConfig()
      assert.equal(normalizer.rules[1].replacement, 'third')
      assert.equal(normalizer.rules[2].replacement, 'fourth')
      assert.equal(normalizer.rules[3].replacement, 'second')
      assert.equal(normalizer.rules[4].replacement, 'first')
    })

    await t.test('with feature flag reverse_naming_rules set to false (default)', function (t) {
      const { normalizer } = t.nr
      normalizer.loadFromConfig()
      assert.equal(normalizer.rules[1].replacement, 'third')
      assert.equal(normalizer.rules[2].replacement, 'first')
      assert.equal(normalizer.rules[3].replacement, 'second')
      assert.equal(normalizer.rules[4].replacement, 'fourth')
    })
  })
})
