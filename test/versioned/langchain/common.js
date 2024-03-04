/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

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

function assertLangChainVectorSearch({ tx, vectorSearch, responseDocumentSize }) {
  const expectedSearch = {
    'id': /[a-f0-9]{36}/,
    'appName': 'New Relic for Node.js tests',
    'span_id': tx.trace.root.children[0].id,
    'trace_id': tx.traceId,
    'transaction_id': tx.id,
    'request.k': 1,
    'request.query': 'This is an embedding test.',
    'ingest_source': 'Node',
    'vendor': 'langchain',
    'virtual_llm': true,
    ['response.number_of_documents']: responseDocumentSize,
    'duration': tx.trace.root.children[0].getDurationInMillis()
  }

  this.equal(vectorSearch[0].type, 'LlmVectorSearch')
  this.match(vectorSearch[1], expectedSearch, 'should match vector search')
}

function assertLangChainVectorSearchResult({ tx, vectorSearchResult, vectorSearchId }) {
  const baseSearchResult = {
    'id': /[a-f0-9]{36}/,
    'search_id': vectorSearchId,
    'appName': 'New Relic for Node.js tests',
    'span_id': tx.trace.root.children[0].id,
    'trace_id': tx.traceId,
    'transaction_id': tx.id,
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

    this.equal(search[0].type, 'LlmVectorSearchResult')
    this.match(search[1], expectedChatMsg, 'should match vector search result')
  })
}

function assertLangChainChatCompletionSummary({ tx, chatSummary, withCallback }) {
  const expectedSummary = {
    'id': /[a-f0-9]{36}/,
    'appName': 'New Relic for Node.js tests',
    'span_id': tx.trace.root.children[0].id,
    'trace_id': tx.traceId,
    'transaction_id': tx.id,
    'request_id': undefined,
    'ingest_source': 'Node',
    'vendor': 'langchain',
    'metadata.key': 'value',
    'metadata.hello': 'world',
    'tags': 'tag1,tag2',
    'virtual_llm': true,
    ['response.number_of_messages']: 1,
    'duration': tx.trace.root.children[0].getDurationInMillis()
  }

  if (withCallback) {
    expectedSummary.request_id = /[a-f0-9\-]{36}/
    expectedSummary.id = /[a-f0-9\-]{36}/
  }

  this.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
  this.match(chatSummary[1], expectedSummary, 'should match chat summary message')
}

function assertLangChainChatCompletionMessages({
  tx,
  chatMsgs,
  chatSummary,
  withCallback,
  input = '{"topic":"scientist"}',
  output = '212 degrees Fahrenheit is equal to 100 degrees Celsius.'
}) {
  const baseMsg = {
    id: /[a-f0-9]{36}/,
    appName: 'New Relic for Node.js tests',
    span_id: tx.trace.root.children[0].id,
    trace_id: tx.traceId,
    transaction_id: tx.id,
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

    this.equal(msg[0].type, 'LlmChatCompletionMessage')
    this.match(msg[1], expectedChatMsg, 'should match chat completion message')
  })
}

tap.Test.prototype.addAssert('langchainMessages', 1, assertLangChainChatCompletionMessages)
tap.Test.prototype.addAssert('langchainSummary', 1, assertLangChainChatCompletionSummary)
tap.Test.prototype.addAssert('langchainVectorSearch', 1, assertLangChainVectorSearch)
tap.Test.prototype.addAssert('langchainVectorSearchResult', 1, assertLangChainVectorSearchResult)

module.exports = {
  filterLangchainEvents,
  filterLangchainEventsByType
}
