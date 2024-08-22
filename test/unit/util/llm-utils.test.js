/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { extractLlmAttributes, extractLlmContext } = require('../../../lib/util/llm-utils')
const { AsyncLocalStorage } = require('async_hooks')

tap.test('extractLlmAttributes', (t) => {
  const context = {
    'skip': 1,
    'llm.get': 2,
    'fllm.skip': 3
  }

  const llmContext = extractLlmAttributes(context)
  t.notOk(llmContext.skip)
  t.notOk(llmContext['fllm.skip'])
  t.equal(llmContext['llm.get'], 2)
  t.end()
})

tap.test('extractLlmContext', (t) => {
  t.beforeEach((t) => {
    const tx = {
      _llmContextManager: new AsyncLocalStorage()
    }
    t.context.agent = {
      tracer: {
        getTransaction: () => {
          return tx
        }
      }
    }
    t.context.tx = tx
  })

  t.test('handle empty context', (t) => {
    const { tx, agent } = t.context
    tx._llmContextManager.run(null, () => {
      const llmContext = extractLlmContext(agent)
      t.equal(typeof llmContext, 'object')
      t.equal(Object.entries(llmContext).length, 0)
      t.end()
    })
  })

  t.test('extract LLM context', (t) => {
    const { tx, agent } = t.context
    tx._llmContextManager.run({ 'llm.test': 1, 'skip': 2 }, () => {
      const llmContext = extractLlmContext(agent)
      t.equal(llmContext['llm.test'], 1)
      t.notOk(llmContext.skip)
      t.end()
    })
  })

  t.test('no transaction', (t) => {
    const { tx, agent } = t.context
    agent.tracer.getTransaction = () => {
      return null
    }
    tx._llmContextManager.run(null, () => {
      const llmContext = extractLlmContext(agent)
      t.equal(typeof llmContext, 'object')
      t.equal(Object.entries(llmContext).length, 0)
      t.end()
    })
  })
  t.end()
})
