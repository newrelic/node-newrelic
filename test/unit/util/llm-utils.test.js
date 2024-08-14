/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { extractLlmAttribtues, extractLlmContext } = require('../../../lib/util/llm-utils')
const { AsyncLocalStorage } = require('async_hooks')

tap.test('extractLlmAttributes', (t) => {
  const context = {
    'skip': 1,
    'llm.get': 2,
    'fllm.skip': 3
  }

  const llmContext = extractLlmAttribtues(context)
  t.notOk(llmContext.skip)
  t.notOk(llmContext['fllm.skip'])
  t.equal(llmContext['llm.get'], 2)
  t.end()
})

tap.test('extractLlmContext', (t) => {
  const tx = {
    _llmContextManager: new AsyncLocalStorage()
  }
  const agent = {
    tracer: {
      getTransaction: () => {
        return tx
      }
    }
  }

  tx._llmContextManager.run({ 'llm.test': 1, 'skip': 2 }, () => {
    const llmContext = extractLlmContext(agent)
    t.equal(llmContext['llm.test'], 1)
    t.notOk(llmContext.skip)
    t.end()
  })
})
