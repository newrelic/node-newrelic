/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { extractLlmAttributes, extractLlmContext } = require('../../../lib/util/llm-utils')
const { AsyncLocalStorage } = require('async_hooks')

test('extractLlmAttributes', () => {
  const context = {
    skip: 1,
    'llm.get': 2,
    'fllm.skip': 3
  }

  const llmContext = extractLlmAttributes(context)
  assert.ok(!llmContext.skip)
  assert.ok(!llmContext['fllm.skip'])
  assert.equal(llmContext['llm.get'], 2)
})

test('extractLlmContext', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const tx = {
      _llmContextManager: new AsyncLocalStorage()
    }
    ctx.nr.agent = {
      tracer: {
        getTransaction: () => {
          return tx
        }
      }
    }
    ctx.nr.tx = tx
  })

  await t.test('handle empty context', (t, end) => {
    const { tx, agent } = t.nr
    tx._llmContextManager.run(null, () => {
      const llmContext = extractLlmContext(agent)
      assert.equal(typeof llmContext, 'object')
      assert.equal(Object.entries(llmContext).length, 0)
      end()
    })
  })

  await t.test('extract LLM context', (t, end) => {
    const { tx, agent } = t.nr
    tx._llmContextManager.run({ 'llm.test': 1, skip: 2 }, () => {
      const llmContext = extractLlmContext(agent)
      assert.equal(llmContext['llm.test'], 1)
      assert.ok(!llmContext.skip)
      end()
    })
  })

  await t.test('no transaction', (t, end) => {
    const { tx, agent } = t.nr
    agent.tracer.getTransaction = () => {
      return null
    }
    tx._llmContextManager.run(null, () => {
      const llmContext = extractLlmContext(agent)
      assert.equal(typeof llmContext, 'object')
      assert.equal(Object.entries(llmContext).length, 0)
      end()
    })
  })
})
