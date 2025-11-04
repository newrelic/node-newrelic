/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

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

module.exports = {
  stringifyClaudeChunkedMessage,
  stringifyConverseChunkedMessage
}
