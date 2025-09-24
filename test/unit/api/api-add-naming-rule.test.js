/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

test('Agent API - addNamingRule', async (t) => {
  const TEST_URL = '/test/path/31337'
  const NAME = 'WebTransaction/Uri/test/path/31337'

  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('exports a function for adding naming rules', (t, end) => {
    const { api } = t.nr
    assert.ok(api.addNamingRule)
    assert.equal(typeof api.addNamingRule, 'function')

    end()
  })

  await t.test("should add it to the agent's normalizer", (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.userNormalizer.rules.length, 1) // default ignore rule
    api.addNamingRule('^/simple.*', 'API')
    assert.equal(agent.userNormalizer.rules.length, 2)

    end()
  })

  await t.test("should add it to the agent's normalizer", (t, end) => {
    const { agent, api } = t.nr
    addNamingRuleGoldenPath(agent, api, () => {
      assert.equal(agent.urlNormalizer.rules.length, 3)
      assert.equal(agent.userNormalizer.rules.length, 1 + 1) // +1 default rule

      end()
    })
  })

  await t.test('should leave the passed-in pattern alone', (t, end) => {
    const { agent, api } = t.nr
    addNamingRuleGoldenPath(agent, api, (mine) => {
      assert.equal(mine.pattern.source, '^\\/test\\/.*')
      end()
    })
  })

  await t.test('should have the correct replacement', (t, end) => {
    const { agent, api } = t.nr
    addNamingRuleGoldenPath(agent, api, (mine) => {
      assert.equal(mine.replacement, '/Test')
      end()
    })
  })

  await t.test('should set it to highest precedence', (t, end) => {
    const { agent, api } = t.nr
    addNamingRuleGoldenPath(agent, api, (mine) => {
      assert.equal(mine.precedence, 0)
      end()
    })
  })

  await t.test('should end further normalization', (t, end) => {
    const { agent, api } = t.nr
    addNamingRuleGoldenPath(agent, api, (mine) => {
      assert.equal(mine.isTerminal, true)
      end()
    })
  })

  await t.test('should only apply it to the whole URL', (t, end) => {
    const { agent, api } = t.nr
    addNamingRuleGoldenPath(agent, api, (mine) => {
      assert.equal(mine.eachSegment, false)
      end()
    })
  })

  await t.test('applies a string pattern correctly', (t, end) => {
    const { agent, api } = t.nr
    api.addNamingRule('^/test/.*', 'Test')

    agent.on('transactionFinished', function (transaction) {
      transaction.url = TEST_URL
      transaction.finalizeNameFromWeb(200)

      assert.equal(transaction.name, 'WebTransaction/NormalizedUri/Test')

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      transaction.end()
    })
  })

  await t.test('applies a regex pattern with capture groups correctly', (t, end) => {
    const { agent, api } = t.nr
    api.addNamingRule(/^\/test\/(.*)\/(.*)/, 'Test/$2')

    agent.on('transactionFinished', function (transaction) {
      transaction.url = '/test/31337/related'
      transaction.finalizeNameFromWeb(200)

      assert.equal(transaction.name, 'WebTransaction/NormalizedUri/Test/related')

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = '/test/31337/related'
      transaction.verb = 'GET'

      transaction.end()
    })
  })
})

function addNamingRuleGoldenPath(agent, api, cb) {
  agent.urlNormalizer.load([
    {
      each_segment: true,
      eval_order: 0,
      terminate_chain: false,
      match_expression: '^(test_match_nothing)$',
      replace_all: false,
      ignore: false,
      replacement: '\\1'
    },
    {
      each_segment: true,
      eval_order: 1,
      terminate_chain: false,
      match_expression: '^[0-9][0-9a-f_,.-]*$',
      replace_all: false,
      ignore: false,
      replacement: '*'
    },
    {
      each_segment: false,
      eval_order: 2,
      terminate_chain: false,
      match_expression: '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
      replace_all: false,
      ignore: false,
      replacement: '\\1/.*\\2'
    }
  ])

  api.addNamingRule('^/test/.*', 'Test')

  const mine = agent.userNormalizer.rules[0]

  cb(mine)
}
