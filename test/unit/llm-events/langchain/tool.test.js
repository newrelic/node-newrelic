/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LangChainTool = require('../../../../lib/llm-events/langchain/tool')

tap.beforeEach((t) => {
  t.context._tx = {
    trace: {
      custom: {
        get() {
          return {
            'llm.conversation_id': 'test-conversation'
          }
        }
      }
    }
  }

  t.context.agent = {
    config: {
      ai_monitoring: {
        record_content: {
          enabled: true
        }
      },
      applications() {
        return ['test-app']
      }
    },
    tracer: {
      getTransaction() {
        return t.context._tx
      }
    }
  }

  t.context.segment = {
    getDurationInMillis() {
      return 1.01
    },
    id: 'segment-1',
    transaction: {
      id: 'tx-1',
      traceId: 'trace-1'
    }
  }

  t.context.runId = 'run-1'
  t.context.metadata = { foo: 'foo' }
  t.context.name = 'test-tool'
  t.context.description = 'test tool description'
  t.context.input = 'input'
  t.context.output = 'output'
})

tap.test('constructs default instance', async (t) => {
  const event = new LangChainTool(t.context)
  t.match(event, {
    input: 'input',
    output: 'output',
    name: 'test-tool',
    description: 'test tool description',
    run_id: 'run-1',
    id: /[a-z0-9-]{36}/,
    appName: 'test-app',
    span_id: 'segment-1',
    transaction_id: 'tx-1',
    trace_id: 'trace-1',
    duration: 1.01,
    ['metadata.foo']: 'foo',
    ingest_source: 'Node',
    vendor: 'langchain'
  })
})

tap.test('respects record_content setting', async (t) => {
  t.context.agent.config.ai_monitoring.record_content.enabled = false
  const event = new LangChainTool(t.context)
  t.equal(event.input, undefined)
  t.equal(event.output, undefined)
})
