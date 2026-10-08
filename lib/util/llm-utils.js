/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

exports = module.exports = { extractLlmContext, extractLlmAttributes }

/**
 * Extract LLM attributes from the LLM context
 *
 * @param {object} context LLM context object
 * @returns {object} LLM custom attributes
 */
function extractLlmAttributes(context) {
  return Object.keys(context).reduce((result, key) => {
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
 * @returns {object} LLM context object
 */
function extractLlmContext(agent) {
  const context = agent.tracer.getTransaction()?._llmContextManager?.getStore() || {}
  return extractLlmAttributes(context)
}
