/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DATASTORE_PATTERN = /^Datastore/
const EXTERN_PATTERN = /^External\/.*/
const SNS_PATTERN = /^MessageBroker\/SNS\/Topic/
const SQS_PATTERN = /^MessageBroker\/SQS\/Queue/
const {
  DESTINATIONS: { TRANS_SEGMENT }
} = require('../../../lib/config/attribute-filter')
const { match } = require('../../lib/custom-assertions')
const assert = require('node:assert')
const SEGMENT_DESTINATION = TRANS_SEGMENT
const helper = require('../../lib/agent_helper')

function checkAWSAttributes(segment, pattern, markedSegments = []) {
  const expectedAttrs = {
    'aws.operation': String,
    'aws.service': String,
    'aws.requestId': String,
    'aws.region': String
  }

  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
    const attrs = segment.attributes.get(TRANS_SEGMENT)
    match(attrs, expectedAttrs)
  }
  segment.children.forEach((child) => {
    checkAWSAttributes(child, pattern, markedSegments)
  })

  return markedSegments
}

function getMatchingSegments(segment, pattern, markedSegments = []) {
  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
  }

  segment.children.forEach((child) => {
    getMatchingSegments(child, pattern, markedSegments)
  })

  return markedSegments
}

function checkExternals({ service, operations, tx, end }) {
  const externals = checkAWSAttributes(tx.trace.root, EXTERN_PATTERN)
  assert.equal(
    externals.length,
    operations.length,
    `should have ${operations.length} aws externals`
  )
  operations.forEach((operation, index) => {
    const attrs = externals[index].attributes.get(TRANS_SEGMENT)
    match(attrs, {
      'aws.operation': operation,
      'aws.requestId': String,
      // in 3.1.0 they fixed service names from lower case
      // see: https://github.com/aws/aws-sdk-js-v3/commit/0011af27a62d0d201296225e2a70276645b3231a
      'aws.service': new RegExp(`${service}|${service.toLowerCase().replace(/ /g, '')}`),
      'aws.region': 'us-east-1'
    })
  })
  end()
}

function assertChatCompletionMessages({ tx, chatMsgs, expectedId, modelId, prompt, resContent }) {
  const baseMsg = {
    'appName': 'New Relic for Node.js tests',
    'request_id': 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
    'trace_id': tx.traceId,
    'span_id': tx.trace.root.children[0].id,
    'response.model': modelId,
    'vendor': 'bedrock',
    'ingest_source': 'Node',
    'role': 'user',
    'is_response': false,
    'completion_id': /[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/
  }

  chatMsgs.forEach((msg) => {
    if (msg[1].sequence > 1) {
      // Streamed responses may have more than two messages.
      // We only care about the start and end of the conversation.
      return
    }

    const expectedChatMsg = { ...baseMsg }
    const id = expectedId ? `${expectedId}-${msg[1].sequence}` : msg[1].id
    if (msg[1].sequence === 0) {
      expectedChatMsg.sequence = 0
      expectedChatMsg.id = id
      expectedChatMsg.content = prompt
    } else if (msg[1].sequence === 1) {
      expectedChatMsg.sequence = 1
      expectedChatMsg.role = 'assistant'
      expectedChatMsg.id = id
      expectedChatMsg.content = resContent
      expectedChatMsg.is_response = true
    }

    assert.equal(msg[0].type, 'LlmChatCompletionMessage')
    match(msg[1], expectedChatMsg)
  })
}

function assertChatCompletionSummary({ tx, modelId, chatSummary, error = false, numMsgs = 2 }) {
  const expectedChatSummary = {
    'id': /[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/,
    'appName': 'New Relic for Node.js tests',
    'request_id': 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
    'llm.conversation_id': 'convo-id',
    'trace_id': tx.traceId,
    'span_id': tx.trace.root.children[0].id,
    'response.model': modelId,
    'vendor': 'bedrock',
    'ingest_source': 'Node',
    'request.model': modelId,
    'duration': tx.trace.root.children[0].getDurationInMillis(),
    'response.number_of_messages': error ? 1 : numMsgs,
    'response.choices.finish_reason': error ? undefined : 'endoftext',
    'request.temperature': 0.5,
    'request.max_tokens': 100,
    'error': error
  }

  assert.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
  match(chatSummary[1], expectedChatSummary)
}

/**
 * Common afterEach hook that unloads agent, stops server, and deletes
 * packages in require cache
 *
 * @param {object} ctx test context
 */
function afterEach(ctx) {
  ctx.nr.server.destroy()
  helper.unloadAgent(ctx.nr.agent)
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('@aws-sdk') || key.includes('@smithy')) {
      delete require.cache[key]
    }
  })
}

module.exports = {
  afterEach,
  assertChatCompletionSummary,
  assertChatCompletionMessages,
  DATASTORE_PATTERN,
  EXTERN_PATTERN,
  SNS_PATTERN,
  SQS_PATTERN,
  SEGMENT_DESTINATION,
  checkAWSAttributes,
  getMatchingSegments,
  checkExternals
}
