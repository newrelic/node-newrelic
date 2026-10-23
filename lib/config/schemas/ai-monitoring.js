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
    basic_telemetry: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true,
      description: 'Indicates whether baseline LLM instrumentation will be registered.'
    },
    enabled: {
      type: ['boolean', 'null'],
      default: null,
      description: 'Deprecated in favor of `ai_monitoring.basic_telemetry.enabled`. Toggles the generation of AI monitoring events by the agent. ' +
      'Unset by default; when unset, `ai_monitoring.basic_telemetry.enabled` decides whether AI monitoring is active, and `false` always disables it.'
    },
    record_content: {
      type: 'object',
      properties: {
        enabled: {
          type: ['boolean', 'null'],
          default: null
        }
      },
      additionalProperties: true,
      description: 'When enabled, the content of LLM messages will be included in the recorded spans (i.e. delivered to the New Relic collector). ' +
      'Unset by default, which records content only when `ai_monitoring.enabled` is `true`; set it explicitly to `true` or `false` to override.'
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
