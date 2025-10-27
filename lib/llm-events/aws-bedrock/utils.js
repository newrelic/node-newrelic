/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { setTokensInResponse } = require('../utils')

/**
 *
 * @param {object[]} chunks - The "chunks" that make up a single conceptual message. In a multi-modal scenario, a single message
 * might have a number of different-typed chunks interspersed
 * @returns {string} - A stringified version of the message. We make a best-effort effort attempt to represent non-text chunks. In the future
 * we may want to extend the agent to support these non-text chunks in a richer way. Placeholders are represented in an XML-like format but
 * are NOT intended to be parsed as valid XML
 */
function stringifyClaudeChunkedMessage(chunks) {
  const stringifiedChunks = chunks.map((msgContent) => {
    switch (msgContent.type) {
      case 'text':
        return msgContent.text
      case 'image':
        return '<image>'
      case 'tool_use':
        return `<tool_use>${msgContent.name}</tool_use>`
      case 'tool_result':
        return `<tool_result>${msgContent.content}</tool_result>`
      default:
        return '<unknown_chunk>'
    }
  })
  return stringifiedChunks.join('\n\n')
}

/**
 *
 * @param {object[]} chunks - The "chunks" that make up a single conceptual message. In a multi-modal scenario, a single message
 * might have a number of different-typed chunks interspersed
 * @returns {string} - A stringified version of the message. We make a best-effort effort attempt to represent non-text chunks. In the future
 * we may want to extend the agent to support these non-text chunks in a richer way. Placeholders are represented in an XML-like format but
 * are NOT intended to be parsed as valid XML
 */
function stringifyConverseChunkedMessage(chunks) {
  const stringifiedChunks = chunks.map((chunk) => {
    if ('text' in chunk) {
      return chunk.text
    } else if ('image' in chunk) {
      return '<image>'
    } else if ('document' in chunk) {
      return `<document>${chunk.document.name ?? ''}</document>`
    } else if ('toolUse' in chunk) {
      return `<tool_use>${chunk.toolUse?.name ?? ''}</tool_use>`
    } else if ('json' in chunk) {
      return `<json>${JSON.stringify(chunk.json)}</json>`
    } else if ('toolResult' in chunk) {
      // Tool results can have their own chunks. For now we intentionally don't recurse in for non-text tool results
      return `<tool_result>${
          stringifyConverseChunkedMessage(
            (chunk.toolResult.content ?? [])
              .filter((subChunk) => !('toolUse' in subChunk || 'toolResult' in subChunk))
            )
        }</tool_result>`
    } else if ('guardContent' in chunk) {
      return `<guard_content>${chunk.guardContent?.text ?? ''}</guard_content>`
    }
    return '<unknown_chunk>'
  })
  return stringifiedChunks.join('\n\n')
}

/**
 * Set the prompt, completion and total token counts on the Llm Event if input and output metadata
 * exists in the response
 * @param {object} response - The response object.
 * @param {object} context - The Llm Event
 */
function setUsageTokens(response, context) {
  // input and output token counts must available in order to add all usage attributes to response
  // if total tokens is not available, we can manually add it up (from input and output token count)
  if (tokenUsageAttributesExist(response)) {
    const promptTokens =
      Number(response?.usage?.input_tokens ||
       response?.usage?.inputTokens ||
        response?.parsedBody?.results?.[0]?.inputTextTokenCount ||
         response?.parsedBody?.usage?.input_tokens)
    const completionTokens =
        Number(response?.usage?.output_tokens ||
         response?.usage?.outputTokens ||
          response?.parsedBody?.results?.[1]?.totalOutputTextTokenCount ||
           response?.parsedBody?.usage.output_tokens)
    const totalTokens = Number(response?.usage?.total_tokens || response?.usage?.totalTokens)

    setTokensInResponse(context, { promptTokens, completionTokens, totalTokens })
    return
  }

  if (tokenUsageHeadersExist(response)) {
    const promptTokens = Number(response?.headers['x-amzn-bedrock-input-token-count'])
    const completionTokens = Number(response?.headers['x-amzn-bedrock-output-token-count'])
    const totalTokens = Number(response?.headers['x-amzn-bedrock-total-token-count'])

    setTokensInResponse(context, { promptTokens, completionTokens, totalTokens })
  }
}

function tokenUsageAttributesExist(response) {
  const tokensA = response?.usage?.input_tokens && response?.usage?.output_tokens
  const tokensB = response?.usage?.inputTokens && response?.usage?.outputTokens

  // titan stream puts tokens in here
  const tokensC = response?.parsedBody?.results?.[0]?.inputTextTokenCount && response?.parsedBody?.results?.[1]?.totalOutputTextTokenCount

  // for llama3 and claude 3 streaming
  const tokensD = response?.parsedBody?.usage?.input_tokens && response?.parsedBody?.usage?.output_tokens

  return tokensA !== undefined || tokensB !== undefined || tokensC !== undefined || tokensD !== undefined
}

function tokenUsageHeadersExist(response) {
  const tokens = response?.headers['x-amzn-bedrock-input-token-count'] && response?.headers['x-amzn-bedrock-output-token-count']
  return tokens !== undefined
}

module.exports = {
  stringifyClaudeChunkedMessage,
  stringifyConverseChunkedMessage,
  tokenUsageHeadersExist,
  tokenUsageAttributesExist,
  setUsageTokens,
}
