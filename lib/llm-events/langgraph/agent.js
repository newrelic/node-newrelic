/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const BaseLlmEvent = require('../event')
const { makeId } = require('../../util/hashes')

/**
 * @typedef {object} LangGraphAgentEventParams
 * @property {Agent} agent The New Relic agent instance.
 * @property {string} name The name of the LangGraph agent, defaults to 'agent'.
 * @property {object} segment The associated NR segment.
 * @property {object} transaction The associated NR transaction.
 * @property {boolean} error A boolean flag to indicate if an error occurred.
 */

module.exports = class LangGraphAgentEvent extends BaseLlmEvent {
  id = makeId(36)
  span_id
  trace_id
  ingest_source = 'Node'
  vendor = 'langgraph'

  /**
   * @param {LangGraphAgentEventParams} params should contain all necessary and optional LangGraph data
   */
  constructor(params) {
    super(params)
    const { agent, segment, transaction, error = false, name = 'agent' } = params

    this.name = name
    this.span_id = segment.id
    this.trace_id = transaction.traceId
    this.error = error

    // Setting `metadata` as the NR agent instance will allow `BaseLlmEvent`
    // to extract the relevant `llm.<user_defined_metadata>`.
    this.metadata = agent
  }
}
