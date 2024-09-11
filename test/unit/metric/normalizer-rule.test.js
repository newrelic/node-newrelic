/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const Rule = require('../../../lib/metrics/normalizer/rule')

test('NormalizerRule', async function (t) {
  await t.test('with a very simple specification', async function (t) {
    t.beforeEach(function (ctx) {
      ctx.nr = {}
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

      ctx.nr.rule = new Rule(sample)
    })

    await t.test('should know whether the rule terminates normalization', function (t) {
      const { rule } = t.nr
      assert.equal(rule.isTerminal, true)
    })

    await t.test('should know its own precedence', function (t) {
      const { rule } = t.nr
      assert.equal(rule.precedence, 0)
    })

    await t.test('should correctly compile the included regexp', function (t) {
      const { rule } = t.nr
      assert.equal(rule.matches('test_match_nothing'), true)
      assert.equal(rule.matches('a test_match_nothing'), false)
      assert.equal(rule.matches("test_match_nothin'"), false)
    })

    await t.test("shouldn't throw if the regexp doesn't compile", function () {
      const whoops = { match_expression: '$[ad^' }
      let bad
      assert.doesNotThrow(function () {
        bad = new Rule(whoops)
      })
      assert.equal(bad.matches(''), true)
    })

    await t.test("should know if the regexp is applied to each 'segment' in the URL", function (t) {
      const { rule } = t.nr
      assert.equal(rule.eachSegment, false)
    })

    await t.test('should know if the regexp replaces all instances in the URL', function (t) {
      const { rule } = t.nr
      assert.equal(rule.replaceAll, false)
    })

    await t.test('should parse the replacement pattern', function (t) {
      const { rule } = t.nr
      assert.equal(rule.replacement, '$1')
    })

    await t.test('should know whether to ignore the URL', function (t) {
      const { rule } = t.nr
      assert.equal(rule.ignore, false)
    })

    await t.test('should be able to take in a non-normalized URL and return it normalized', (t) => {
      const { rule } = t.nr
      assert.equal(rule.apply('test_match_nothing'), 'test_match_nothing')
    })
  })

  await t.test("with Saxon's patterns", async function (t) {
    await t.test("including '^(?!account|application).*'", async function (t) {
      t.beforeEach(function (ctx) {
        ctx.nr = {}
        ctx.nr.rule = new Rule({
          each_segment: true,
          match_expression: '^(?!account|application).*',
          replacement: '*'
        })
      })

      await t.test(
        "implies '/account/myacc/application/test' -> '/account/*/application/*'",
        function (t) {
          const { rule } = t.nr
          assert.equal(rule.apply('/account/myacc/application/test'), '/account/*/application/*')
        }
      )

      await t.test(
        "implies '/oh/dude/account/myacc/application' -> '/*/*/account/*/application'",
        function (t) {
          const { rule } = t.nr
          assert.equal(
            rule.apply('/oh/dude/account/myacc/application'),
            '/*/*/account/*/application'
          )
        }
      )
    })

    const expression =
      '^(?!channel|download|popups|search|tap|user' + '|related|admin|api|genres|notification).*'

    await t.test(`including '${expression}'`, async function (t) {
      t.beforeEach(function (ctx) {
        ctx.nr = {}
        ctx.nr.rule = new Rule({
          each_segment: true,
          match_expression: expression,
          replacement: '*'
        })
      })

      await t.test("implies '/tap/stuff/user/gfy77t/view' -> '/tap/*/user/*/*'", function (t) {
        const { rule } = t.nr
        assert.equal(rule.apply('/tap/stuff/user/gfy77t/view'), '/tap/*/user/*/*')
      })
    })
  })

  await t.test('with a more complex substitution rule', async function (t) {
    t.beforeEach(function (ctx) {
      ctx.nr = {}
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

      ctx.nr.rule = new Rule(sample)
    })

    await t.test('should know whether the rule terminates normalization', function (t) {
      const { rule } = t.nr
      assert.equal(rule.isTerminal, false)
    })

    await t.test('should know its own precedence', function (t) {
      const { rule } = t.nr
      assert.equal(rule.precedence, 1)
    })

    await t.test('should correctly compile the included regexp', function (t) {
      const { rule } = t.nr
      assert.equal(rule.matches('/00dead_beef_00,b/hamburt'), true)
      assert.equal(rule.matches('a test_match_nothing'), false)
      assert.equal(rule.matches('/00 dead dad/nomatch'), false)
    })

    await t.test("should know if the regexp is applied to each 'segment' in the URL", function (t) {
      const { rule } = t.nr
      assert.equal(rule.eachSegment, true)
    })

    await t.test('should know if the regexp replaces all instances in the URL', function (t) {
      const { rule } = t.nr
      assert.equal(rule.replaceAll, false)
    })

    await t.test('should parse the replacement pattern', function (t) {
      const { rule } = t.nr
      assert.equal(rule.replacement, '*')
    })

    await t.test('should know whether to ignore the URL', function (t) {
      const { rule } = t.nr
      assert.equal(rule.ignore, false)
    })

    await t.test('should be able to take in a non-normalized URL and return it normalized', (t) => {
      const { rule } = t.nr
      assert.equal(rule.apply('/00dead_beef_00,b/hamburt'), '/*/hamburt')
    })
  })

  await t.test('should replace all the instances of a pattern when so specified', function () {
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

    assert.equal(rule.pattern.global, true)
    assert.equal(rule.apply('/test/xXxxXx0xXxzxxxxXx'), '/test/yy0yzyy')
  })

  await t.test('when given an incomplete specification', async function (t) {
    await t.test("shouldn't throw (but it can log!)", function () {
      assert.doesNotThrow(function () {
        // eslint-disable-next-line no-new
        new Rule()
      })
    })

    await t.test('should default to not applying the rule to each segment', function () {
      assert.equal(new Rule().eachSegment, false)
    })

    await t.test("should default the rule's precedence to 0", function () {
      assert.equal(new Rule().precedence, 0)
    })

    await t.test('should default to not terminating rule evaluation', function () {
      assert.equal(new Rule().isTerminal, false)
    })

    await t.test('should have a regexp that matches the empty string', function () {
      assert.deepEqual(new Rule().pattern, /^$/i)
    })

    await t.test('should use the entire match as the replacement value', function () {
      assert.equal(new Rule().replacement, '$0')
    })

    await t.test('should default to not replacing all instances', function () {
      assert.equal(new Rule().replaceAll, false)
    })

    await t.test('should default to not ignoring matching URLs', function () {
      assert.equal(new Rule().ignore, false)
    })

    await t.test('should silently pass through the input if applied', function () {
      assert.equal(new Rule().apply('sample/input'), 'sample/input')
    })
  })

  await t.test('when given a RegExp', async function (t) {
    await t.test('should merge flags', function () {
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
      assert.equal(re.ignoreCase, true)
      assert.equal(re.multiline, true)
      assert.equal(re.global, true)
    })

    await t.test('should not die on duplicated flags', function () {
      let r = null
      assert.doesNotThrow(function () {
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
      assert.equal(re.ignoreCase, true)
      assert.equal(re.multiline, false)
      assert.equal(re.global, true)
    })
  })
})
