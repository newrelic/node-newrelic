/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseEvent = require('../event')
const { makeId } = require('../../util/hashes')
const { isSimpleObject } = require('../../util/objects')

/**
 * @typedef {object} LangChainEventParams
 * @property {object} agent A New Relic agent instance.
 * @property {object} segment A New Relic segment instance.
 * @property {string} runId The identifier LangChain has assigned to the "run."
 * @property {Object<string, string>} metadata The metadata, if any, associated with the
 * LangChain run.
 * @property {boolean|undefined} [virtual=true] Indicates that this event is a
 * LangChain specific event (`true`). LangChain is not itself an LLM, but an
 * interface to many LLMs. Any LLMs LangChain interacts with that we have
 * instrumented will have their own traces that are not "virtual."
 */
/**
 * @type {LangChainEventParams}
 */
const defaultParams = {
  agent: {},
  segment: {
    transaction: {}
  },
  runId: '',
  metadata: {},
  virtual: undefined
}

/**
 * Baseline object representing an event in a LangChain conversation.
 */
class LangChainEvent extends BaseEvent {
  id = makeId(36)
  appName
  conversation_id
  span_id
  request_id
  transaction_id
  trace_id
  ingest_source = 'Node'
  vendor = 'langchain'
  virtual_llm = true

  constructor(params = defaultParams) {
    params = Object.assign({}, defaultParams, params)
    super(params)
    const { agent, segment } = params

    this.appName = agent.config.applications()[0]
    this.conversation_id = this.conversationId(agent)
    this.span_id = segment?.id
    this.request_id = params.runId
    this.transaction_id = segment?.transaction?.id
    this.trace_id = segment?.transaction?.traceId
    this.metadata = params.metadata

    if (params.virtual !== undefined) {
      if (params.virtual !== true && params.virtual !== false) {
        throw Error('params.virtual must be a primitive boolean')
      }
      this.virtual_llm = params.virtual
    }
  }

  set metadata(value) {
    if (isSimpleObject(value) === false) {
      return
    }
    for (const [key, val] of Object.entries(value)) {
      this[`metadata.${key}`] = val
    }
  }
}

module.exports = LangChainEvent
