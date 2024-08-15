/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

exports = module.exports = { extractLlmContext, extractLlmAttribtues }

/**
 * Extract LLM attributes from the LLM context
 *
 * @param {Object} context LLM context object
 * @returns {Object} LLM custom attributes
 */
function extractLlmAttribtues(context) {
  return Object.keys(context || {}).reduce((result, key) => {
    if (key.indexOf('llm.') === 0) {
      result[key] = context[key]
    }
    return result
  }, {})
}

/**
 * Extract LLM context from the active transaction
 *
 * @param {Agent} agent NR agent instance
 * @returns {Object} LLM context object
 */
function extractLlmContext(agent) {
  let context = agent.tracer.getTransaction()._llmContextManager
    ? agent.tracer.getTransaction()._llmContextManager.getStore()
    : null
  const llmContext = {}
  while (context) {
    Object.assign(llmContext, extractLlmAttribtues(context))
    context = null
  }
  return llmContext
}
