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
const fs = require('node:fs')
const path = require('node:path')

function checkAWSAttributes({ trace, segment, pattern, markedSegments = [] }) {
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
  const children = trace.getChildren(segment.id)
  children.forEach((child) => {
    checkAWSAttributes({ trace, segment: child, pattern, markedSegments })
  })

  return markedSegments
}

function getMatchingSegments({ trace, segment, pattern, markedSegments = [] }) {
  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
  }

  const children = trace.getChildren(segment.id)
  children.forEach((child) => {
    getMatchingSegments({ trace, segment: child, pattern, markedSegments })
  })

  return markedSegments
}

function checkExternals({ service, operations, tx, end }) {
  const externals = checkAWSAttributes({
    trace: tx.trace,
    segment: tx.trace.root,
    pattern: EXTERN_PATTERN
  })
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
  chatMsgs.forEach((msg) => {
    if (msg[1].sequence > 1) {
      // Streamed responses may have more than two messages.
      // We only care about the start and end of the conversation.
      return
    }

    const isResponse = msg[1].sequence === 1
    assertChatCompletionMessage({
      tx,
      message: msg,
      expectedId,
      modelId,
      expectedContent: isResponse ? resContent : prompt,
      isResponse,
      expectedRole: isResponse ? 'assistant' : 'user'
    })
  })
}

function assertChatCompletionMessage({
  tx,
  message,
  expectedId,
  modelId,
  expectedContent,
  isResponse,
  expectedRole
}) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const baseMsg = {
    appName: 'New Relic for Node.js tests',
    request_id: 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
    trace_id: tx.traceId,
    span_id: segment.id,
    'response.model': modelId,
    vendor: 'bedrock',
    ingest_source: 'Node',
    role: 'user',
    is_response: false,
    completion_id: /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/
  }

  const [messageBase, messageData] = message

  const expectedChatMsg = { ...baseMsg }
  const id = expectedId ? `${expectedId}-${messageData.sequence}` : messageData.id

  expectedChatMsg.sequence = messageData.sequence
  expectedChatMsg.role = expectedRole
  expectedChatMsg.id = id
  expectedChatMsg.content = expectedContent
  expectedChatMsg.is_response = isResponse

  assert.equal(messageBase.type, 'LlmChatCompletionMessage')
  match(messageData, expectedChatMsg)
}

function assertChatCompletionSummary({ tx, modelId, chatSummary, error = false, numMsgs = 2 }) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const expectedChatSummary = {
    id: /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/,
    appName: 'New Relic for Node.js tests',
    request_id: 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
    'llm.conversation_id': 'convo-id',
    trace_id: tx.traceId,
    span_id: segment.id,
    'response.model': modelId,
    vendor: 'bedrock',
    ingest_source: 'Node',
    'request.model': modelId,
    duration: segment.getDurationInMillis(),
    'response.number_of_messages': error ? 1 : numMsgs,
    'response.choices.finish_reason': error ? undefined : 'endoftext',
    'request.temperature': 0.5,
    'request.max_tokens': 100,
    error
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

function getAiResponseServer() {
  const semver = require('semver')
  const { version: pkgVersion } = JSON.parse(
    fs.readFileSync(path.join(__dirname, '/node_modules/@aws-sdk/client-bedrock-runtime/package.json'))
  )
  if (semver.gte(pkgVersion, '3.798.0')) {
    return require('../../lib/aws-server-stubs/ai-server/http2')
  }
  return require('../../lib/aws-server-stubs/ai-server')
}

module.exports = {
  afterEach,
  assertChatCompletionSummary,
  assertChatCompletionMessages,
  assertChatCompletionMessage,
  DATASTORE_PATTERN,
  EXTERN_PATTERN,
  SNS_PATTERN,
  SQS_PATTERN,
  SEGMENT_DESTINATION,
  checkAWSAttributes,
  getMatchingSegments,
  checkExternals,
  getAiResponseServer
}
