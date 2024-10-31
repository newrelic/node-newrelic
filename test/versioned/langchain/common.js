/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { match } = require('../../lib/custom-assertions')

function filterLangchainEvents(events) {
  return events.filter((event) => {
    const [, chainEvent] = event
    return chainEvent.vendor === 'langchain'
  })
}

function filterLangchainEventsByType(events, msgType) {
  return events.filter((event) => {
    const [{ type }] = event
    return type === msgType
  })
}

function assertLangChainVectorSearch(
  { tx, vectorSearch, responseDocumentSize },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const expectedSearch = {
    'id': /[a-f0-9]{36}/,
    'appName': 'New Relic for Node.js tests',
    'span_id': segment.id,
    'trace_id': tx.traceId,
    'request.k': 1,
    'request.query': 'This is an embedding test.',
    'ingest_source': 'Node',
    'vendor': 'langchain',
    'virtual_llm': true,
    ['response.number_of_documents']: responseDocumentSize,
    'duration': segment.getDurationInMillis()
  }

  assert.equal(vectorSearch[0].type, 'LlmVectorSearch')
  match(vectorSearch[1], expectedSearch, { assert })
}

function assertLangChainVectorSearchResult(
  { tx, vectorSearchResult, vectorSearchId },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const baseSearchResult = {
    'id': /[a-f0-9]{36}/,
    'search_id': vectorSearchId,
    'appName': 'New Relic for Node.js tests',
    'span_id': segment.id,
    'trace_id': tx.traceId,
    'ingest_source': 'Node',
    'vendor': 'langchain',
    'metadata.id': '2',
    'virtual_llm': true
  }

  vectorSearchResult.forEach((search) => {
    const expectedChatMsg = { ...baseSearchResult }
    if (search[1].sequence === 0) {
      expectedChatMsg.sequence = 0
      expectedChatMsg.page_content = 'This is an embedding test.'
    } else if (search[1].sequence === 1) {
      expectedChatMsg.sequence = 1
      expectedChatMsg.page_content = '212 degrees Fahrenheit is equal to 100 degrees Celsius.'
    }

    assert.equal(search[0].type, 'LlmVectorSearchResult')
    match(search[1], expectedChatMsg, { assert })
  })
}

function assertLangChainChatCompletionSummary(
  { tx, chatSummary, withCallback },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const expectedSummary = {
    'id': /[a-f0-9]{36}/,
    'appName': 'New Relic for Node.js tests',
    'span_id': segment.id,
    'trace_id': tx.traceId,
    'request_id': undefined,
    'ingest_source': 'Node',
    'vendor': 'langchain',
    'metadata.key': 'value',
    'metadata.hello': 'world',
    'tags': 'tag1,tag2',
    'virtual_llm': true,
    ['response.number_of_messages']: 1,
    'duration': segment.getDurationInMillis()
  }

  if (withCallback) {
    expectedSummary.request_id = /[a-f0-9\-]{36}/
    expectedSummary.id = /[a-f0-9\-]{36}/
  }

  assert.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
  match(chatSummary[1], expectedSummary, { assert })
}

function assertLangChainChatCompletionMessages(
  {
    tx,
    chatMsgs,
    chatSummary,
    withCallback,
    input = '{"topic":"scientist"}',
    output = '212 degrees Fahrenheit is equal to 100 degrees Celsius.'
  },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const baseMsg = {
    id: /[a-f0-9]{36}/,
    appName: 'New Relic for Node.js tests',
    span_id: segment.id,
    trace_id: tx.traceId,
    ingest_source: 'Node',
    vendor: 'langchain',
    completion_id: chatSummary.id,
    virtual_llm: true,
    request_id: undefined
  }

  if (withCallback) {
    baseMsg.request_id = /[a-f0-9\-]{36}/
    baseMsg.id = /[a-f0-9\-]{36}/
  }

  chatMsgs.forEach((msg) => {
    const expectedChatMsg = { ...baseMsg }
    if (msg[1].sequence === 0) {
      expectedChatMsg.sequence = 0
      expectedChatMsg.content = input
      expectedChatMsg.is_response = false
    } else if (msg[1].sequence === 1) {
      expectedChatMsg.sequence = 1
      expectedChatMsg.content = output
      expectedChatMsg.is_response = true
    }

    assert.equal(msg[0].type, 'LlmChatCompletionMessage')
    match(msg[1], expectedChatMsg, { assert })
  })
}

module.exports = {
  assertLangChainChatCompletionMessages,
  assertLangChainChatCompletionSummary,
  assertLangChainVectorSearch,
  assertLangChainVectorSearchResult,
  filterLangchainEvents,
  filterLangchainEventsByType
}
