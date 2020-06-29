/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - addIgnoringRule', (t) => {
  t.autoend()

  let agent = null
  let api = null

  const TEST_URL = '/test/path/31337'
  const NAME = 'WebTransaction/Uri/test/path/31337'

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    agent = null

    done()
  })

  t.test("exports a function for ignoring certain URLs", (t) => {
    t.ok(api.addIgnoringRule)
    t.type(api.addIgnoringRule, 'function')

    t.end()
  })

  t.test("should add it to the agent's normalizer", (t) => {
    t.equal(agent.userNormalizer.rules.length, 1) // default ignore rule
    api.addIgnoringRule('^/simple.*')
    t.equal(agent.userNormalizer.rules.length, 2)

    t.end()
  })

  t.test("should add it to the agent's normalizer", (t) => {
    addIgnoringRuleGoldenPath(agent, api, () => {
      t.equal(agent.urlNormalizer.rules.length, 3)
      t.equal(agent.userNormalizer.rules.length, 1 + 1) // +1 default rule

      t.end()
    })
  })

  t.test("should leave the passed-in pattern alone", (t) => {
    addIgnoringRuleGoldenPath(agent, api, (mine) => {
      t.equal(mine.pattern.source, '^\\/test\\/.*')
      t.end()
    })
  })

  t.test("should have the correct replacement", (t) => {
    addIgnoringRuleGoldenPath(agent, api, (mine) => {
      t.equal(mine.replacement, '$0')
      t.end()
    })
  })

  t.test("should set it to highest precedence", (t) => {
    addIgnoringRuleGoldenPath(agent, api, (mine) => {
      t.equal(mine.precedence, 0)
      t.end()
    })
  })

  t.test("should end further normalization", (t) => {
    addIgnoringRuleGoldenPath(agent, api, (mine) => {
      t.equal(mine.isTerminal, true)
      t.end()
    })
  })

  t.test("should only apply it to the whole URL", (t) => {
    addIgnoringRuleGoldenPath(agent, api, (mine) => {
      t.equal(mine.eachSegment, false)
      t.end()
    })
  })

  t.test("should ignore transactions related to that URL", (t) => {
    addIgnoringRuleGoldenPath(agent, api, (mine) => {
      t.equal(mine.ignore, true)
      t.end()
    })
  })

  t.test("applies a string pattern correctly", (t) => {
    api.addIgnoringRule('^/test/.*')

    agent.on('transactionFinished', function(transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)

      t.equal(transaction.ignore, true)

      t.end()
    })

    helper.runInTransaction(agent, function(transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      transaction.end()
    })
  })
})

function addIgnoringRuleGoldenPath(agent, api, cb) {
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

  api.addIgnoringRule('^/test/.*')
  const mine = agent.userNormalizer.rules[0]

  cb(mine)
}
