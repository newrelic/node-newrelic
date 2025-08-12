/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const {
  ConverseStreamHandler
} = require('../../../../lib/llm-events/aws-bedrock')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.response = {
    response: {
      headers: {
        'x-amzn-requestid': 'aws-req-1'
      },
      statusCode: 200
    },
    output: {
      body: {}
    }
  }

  ctx.nr.passThroughParams = {
    response: ctx.nr.response,
    segment: {
      touch() {
        assert.ok(true)
      }
    },
    bedrockCommand: {

    }
  }

  ctx.nr.onComplete = (params) => {
    assert.deepStrictEqual(params, ctx.nr.passThroughParams)
  }
})

const simpleTextChunks = [
  {
    messageStart: {
      p: 'abcd',
      role: 'assistant'
    }
  },
  {
    contentBlockDelta: {
      p: 'abcd',
      delta: {
        text: 'Hello'
      }
    }
  },
  {
    contentBlockDelta: {
      p: 'abcde',
      delta: {
        text: ' world'
      }
    }
  },
  {
    contentBlockDelta: {
      p: 'abcd',
      delta: {
        text: '!!'
      }
    }
  },
  {
    contentBlockStop: {
      contentBlockIndex: 0,
      p: 'abcd'
    }
  },
  {
    messageStop: {
      stopReason: 'end_turn'
    }
  },
  {
    metadata: {
      metrics: { latencyMs: 100 },
      usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 }
    }
  }
]

const toolUseChunks = [
  {
    messageStart: {
      p: 'abcd',
      role: 'assistant'
    }
  },
  {
    contentBlockDelta: {
      p: 'abcd',
      delta: {
        text: 'I should call a tool'
      }
    }
  },
  {
    contentBlockStop: {
      contentBlockIndex: 0,
      p: 'abcd'
    }
  },
  {
    contentBlockStart: {
      contentBlockIndex: 1,
      start: {
        toolUse: {
          name: 'some-tool',
          toolUseId: 'abc123'
        }
      }
    }
  },
  {
    contentBlockDelta: {
      contentBlockIndex: 1,
      delta: {
        toolUse: {
          input: '{ "foo": '
        }
      }
    }
  },
  {
    contentBlockDelta: {
      contentBlockIndex: 1,
      delta: {
        toolUse: {
          input: '"bar" }'
        }
      }
    }
  },
  {
    contentBlockStop: {
      contentBlockIndex: 1
    }
  },
  {
    messageStop: {
      stopReason: 'tool_use'
    }
  },
  {
    metadata: {
      metrics: { latencyMs: 100 },
      usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 }
    }
  }
]

test('Handles a simple text-based chat', async (t) => {
  t.nr.stream = asyncGeneratorFromChunks(simpleTextChunks)
  const handler = new ConverseStreamHandler(t.nr)
  let i = 0
  for await (const event of handler.generator()) {
    // All stream messages must be re-emitted as-is so that consumer code works
    assert.deepStrictEqual(event, simpleTextChunks[i])
    i++
  }
  assert.deepEqual(handler.response.output, { output: { message: { content: [{ text: 'Hello world!!' }] } } })
})

test('Handles multi-chunk tool-call streams ', async (t) => {
  t.nr.stream = asyncGeneratorFromChunks(toolUseChunks)
  const handler = new ConverseStreamHandler(t.nr)
  let i = 0
  for await (const event of handler.generator()) {
    // All stream messages must be re-emitted as-is so that consumer code works
    assert.deepStrictEqual(event, toolUseChunks[i])
    i++
  }
  assert.deepEqual(handler.response.output, { output: { message: { content: [{ text: 'I should call a tool' }, { toolUse: { name: 'some-tool' } }] } } })
})

test('Can start new chunks whether or not an explicit start event is seen', async (t) => {
  const chunks = [
    {
      messageStart: {
        p: 'abcd',
        role: 'assistant'
      }
    },
    {
      contentBlockStart: {
        contentBlockIndex: 0
      }
    },
    {
      contentBlockDelta: {
        p: 'abcd',
        delta: {
          text: 'Hello world'
        }
      }
    },
    {
      contentBlockStop: {
        contentBlockIndex: 0,
        p: 'abcd'
      }
    }]

  t.nr.stream = asyncGeneratorFromChunks(chunks)
  let handler = new ConverseStreamHandler(t.nr)
  // eslint-disable-next-line sonarjs/no-unused-vars, no-unused-vars
  for await (const _ of handler.generator()) { /* empty */ }
  assert.deepEqual(handler.response.output, { output: { message: { content: [{ text: 'Hello world' }] } } })

  t.nr.stream = asyncGeneratorFromChunks(chunks.filter((chunk) => !chunk.contentBlockStart))
  handler = new ConverseStreamHandler(t.nr)
  // eslint-disable-next-line sonarjs/no-unused-vars, no-unused-vars
  for await (const _ of handler.generator()) { /* empty */ }
  assert.deepEqual(handler.response.output, { output: { message: { content: [{ text: 'Hello world' }] } } })
})

function asyncGeneratorFromChunks(chunks) {
  return (async function * originalStream() {
    for (const chunk of chunks) {
      yield chunk
    }
  }())
}
