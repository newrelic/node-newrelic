/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const Rule = require('../../../lib/metrics/normalizer/rule')

tap.test('NormalizerRule', function (t) {
  t.autoend()
  t.test('with a very simple specification', function (t) {
    t.autoend()
    t.beforeEach(function (t) {
      // sample rule sent by staging collector 1 on 2012-08-29
      const sample = {
        each_segment: false,
        eval_order: 0,
        terminate_chain: true,
        match_expression: '^(test_match_nothing)$',
        replace_all: false,
        ignore: false,
        replacement: '\\1'
      }

      t.context.rule = new Rule(sample)
    })

    t.test('should know whether the rule terminates normalization', function (t) {
      const { rule } = t.context
      t.equal(rule.isTerminal, true)
      t.end()
    })

    t.test('should know its own precedence', function (t) {
      const { rule } = t.context
      t.equal(rule.precedence, 0)
      t.end()
    })

    t.test('should correctly compile the included regexp', function (t) {
      const { rule } = t.context
      t.equal(rule.matches('test_match_nothing'), true)
      t.equal(rule.matches('a test_match_nothing'), false)
      t.equal(rule.matches("test_match_nothin'"), false)
      t.end()
    })

    t.test("shouldn't throw if the regexp doesn't compile", function (t) {
      const whoops = { match_expression: '$[ad^' }
      let bad
      t.doesNotThrow(function () {
        bad = new Rule(whoops)
      })
      t.equal(bad.matches(''), true)
      t.end()
    })

    t.test("should know if the regexp is applied to each 'segment' in the URL", function (t) {
      const { rule } = t.context
      t.equal(rule.eachSegment, false)
      t.end()
    })

    t.test('should know if the regexp replaces all instances in the URL', function (t) {
      const { rule } = t.context
      t.equal(rule.replaceAll, false)
      t.end()
    })

    t.test('should parse the replacement pattern', function (t) {
      const { rule } = t.context
      t.equal(rule.replacement, '$1')
      t.end()
    })

    t.test('should know whether to ignore the URL', function (t) {
      const { rule } = t.context
      t.equal(rule.ignore, false)
      t.end()
    })

    t.test('should be able to take in a non-normalized URL and return it normalized', (t) => {
      const { rule } = t.context
      t.equal(rule.apply('test_match_nothing'), 'test_match_nothing')
      t.end()
    })
  })

  t.test("with Saxon's patterns", function (t) {
    t.autoend()
    t.test("including '^(?!account|application).*'", function (t) {
      t.autoend()
      t.beforeEach(function (t) {
        t.context.rule = new Rule({
          each_segment: true,
          match_expression: '^(?!account|application).*',
          replacement: '*'
        })
      })

      t.test(
        "implies '/account/myacc/application/test' -> '/account/*/application/*'",
        function (t) {
          const { rule } = t.context
          t.equal(rule.apply('/account/myacc/application/test'), '/account/*/application/*')
          t.end()
        }
      )

      t.test(
        "implies '/oh/dude/account/myacc/application' -> '/*/*/account/*/application'",
        function (t) {
          const { rule } = t.context
          t.equal(rule.apply('/oh/dude/account/myacc/application'), '/*/*/account/*/application')
          t.end()
        }
      )
    })

    const expression =
      '^(?!channel|download|popups|search|tap|user' + '|related|admin|api|genres|notification).*'

    t.test(`including '${expression}'`, function (t) {
      t.autoend()
      t.beforeEach(function (t) {
        t.context.rule = new Rule({
          each_segment: true,
          match_expression: expression,
          replacement: '*'
        })
      })

      t.test("implies '/tap/stuff/user/gfy77t/view' -> '/tap/*/user/*/*'", function (t) {
        const { rule } = t.context
        t.equal(rule.apply('/tap/stuff/user/gfy77t/view'), '/tap/*/user/*/*')
        t.end()
      })
    })
  })

  t.test('with a more complex substitution rule', function (t) {
    t.autoend()
    t.beforeEach(function (t) {
      // sample rule sent by staging collector 1 on 2012-08-29
      const sample = {
        each_segment: true,
        eval_order: 1,
        terminate_chain: false,
        match_expression: '^[0-9][0-9a-f_,.-]*$',
        replace_all: false,
        ignore: false,
        replacement: '*'
      }

      t.context.rule = new Rule(sample)
    })

    t.test('should know whether the rule terminates normalization', function (t) {
      const { rule } = t.context
      t.equal(rule.isTerminal, false)
      t.end()
    })

    t.test('should know its own precedence', function (t) {
      const { rule } = t.context
      t.equal(rule.precedence, 1)
      t.end()
    })

    t.test('should correctly compile the included regexp', function (t) {
      const { rule } = t.context
      t.equal(rule.matches('/00dead_beef_00,b/hamburt'), true)
      t.equal(rule.matches('a test_match_nothing'), false)
      t.equal(rule.matches('/00 dead dad/nomatch'), false)
      t.end()
    })

    t.test("should know if the regexp is applied to each 'segment' in the URL", function (t) {
      const { rule } = t.context
      t.equal(rule.eachSegment, true)
      t.end()
    })

    t.test('should know if the regexp replaces all instances in the URL', function (t) {
      const { rule } = t.context
      t.equal(rule.replaceAll, false)
      t.end()
    })

    t.test('should parse the replacement pattern', function (t) {
      const { rule } = t.context
      t.equal(rule.replacement, '*')
      t.end()
    })

    t.test('should know whether to ignore the URL', function (t) {
      const { rule } = t.context
      t.equal(rule.ignore, false)
      t.end()
    })

    t.test('should be able to take in a non-normalized URL and return it normalized', (t) => {
      const { rule } = t.context
      t.equal(rule.apply('/00dead_beef_00,b/hamburt'), '/*/hamburt')
      t.end()
    })
  })

  t.test('should replace all the instances of a pattern when so specified', function (t) {
    const sample = {
      each_segment: false,
      eval_order: 0,
      terminate_chain: false,
      match_expression: 'xXx',
      replace_all: true,
      ignore: false,
      replacement: 'y'
    }
    const rule = new Rule(sample)

    t.equal(rule.pattern.global, true)
    t.equal(rule.apply('/test/xXxxXx0xXxzxxxxXx'), '/test/yy0yzyy')
    t.end()
  })

  t.test('when given an incomplete specification', function (t) {
    t.autoend()
    t.test("shouldn't throw (but it can log!)", function (t) {
      t.doesNotThrow(function () {
        // eslint-disable-next-line no-new
        new Rule()
      })
      t.end()
    })

    t.test('should default to not applying the rule to each segment', function (t) {
      t.equal(new Rule().eachSegment, false)
      t.end()
    })

    t.test("should default the rule's precedence to 0", function (t) {
      t.equal(new Rule().precedence, 0)
      t.end()
    })

    t.test('should default to not terminating rule evaluation', function (t) {
      t.equal(new Rule().isTerminal, false)
      t.end()
    })

    t.test('should have a regexp that matches the empty string', function (t) {
      t.same(new Rule().pattern, /^$/i)
      t.end()
    })

    t.test('should use the entire match as the replacement value', function (t) {
      t.equal(new Rule().replacement, '$0')
      t.end()
    })

    t.test('should default to not replacing all instances', function (t) {
      t.equal(new Rule().replaceAll, false)
      t.end()
    })

    t.test('should default to not ignoring matching URLs', function (t) {
      t.equal(new Rule().ignore, false)
      t.end()
    })

    t.test('should silently pass through the input if applied', function (t) {
      t.equal(new Rule().apply('sample/input'), 'sample/input')
      t.end()
    })
  })

  t.test('when given a RegExp', function (t) {
    t.autoend()
    t.test('should merge flags', function (t) {
      const r = new Rule({
        each_segment: false,
        eval_order: 0,
        terminate_chain: false,
        match_expression: /foo/m,
        replace_all: true,
        ignore: false,
        replacement: 'y'
      })

      const re = r.pattern
      t.equal(re.ignoreCase, true)
      t.equal(re.multiline, true)
      t.equal(re.global, true)
      t.end()
    })

    t.test('should not die on duplicated flags', function (t) {
      let r = null
      t.doesNotThrow(function () {
        r = new Rule({
          each_segment: false,
          eval_order: 0,
          terminate_chain: false,
          match_expression: /foo/gi,
          replace_all: true,
          ignore: false,
          replacement: 'y'
        })
      })

      const re = r.pattern
      t.equal(re.ignoreCase, true)
      t.equal(re.multiline, false)
      t.equal(re.global, true)
      t.end()
    })
  })
})
