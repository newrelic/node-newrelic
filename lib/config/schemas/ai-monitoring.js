/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'ai-monitoring.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Toggles the generation of AI monitoring events by the agent.'
    },
    record_content: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true,
      description: 'When enabled, the content of LLM messages will be included in the recorded spans (i.e. delivered to the New Relic collector). This is enabled by default.'
    },
    streaming: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true,
      description: 'Toggles the capturing of Llm events when using streaming based methods in AIM supported libraries(i.e.- openai, AWS bedrock, langchain)'
    }
  },
  additionalProperties: true,
  description: 'When enabled, instrumentation of supported AI libraries will be in effect.'
}
