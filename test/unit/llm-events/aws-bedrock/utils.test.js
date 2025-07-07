/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { stringifyClaudeChunkedMessage, stringifyConverseChunkedMessage } = require('../../../../lib/llm-events/aws-bedrock/utils')

test.describe(stringifyClaudeChunkedMessage.name, {}, () => {
  test('interleaves text chunks with other types', (t) => {
    const out = stringifyClaudeChunkedMessage([
      { type: 'text', text: 'Hello' },
      { type: 'image', source: { type: 'base64', data: 'U29tZSByYW5kb20gaW1hZ2U=', media_type: 'image/jpeg' } },
      { type: 'text', text: 'world' }
    ])

    assert.equal(out, 'Hello\n\n<image>\n\nworld')
  })

  test('adds a placeholder for unrecognized chunk types', (t) => {
    const out = stringifyClaudeChunkedMessage([
      { type: 'text', text: 'Hello' },
      { type: 'direct_neural_upload', data: 'V2hhdCBzaG91bGQgSSBtYWtlIGZvciBkaW5uZXI/' },
      { type: 'text', text: 'world' }
    ])

    assert.equal(out, 'Hello\n\n<unknown_chunk>\n\nworld')
  })

  test('adds information about tool calls', (t) => {
    const out = stringifyClaudeChunkedMessage([
      { type: 'text', text: 'I will look up the weather in Philly' },
      { type: 'tool_use', name: 'lookup_weather', input: { city: 'Philly' }, id: 'abc123' },
    ])

    assert.equal(out, 'I will look up the weather in Philly\n\n<tool_use>lookup_weather</tool_use>')
  })

  test('adds information about tool results', (t) => {
    const out = stringifyClaudeChunkedMessage([
      { type: 'text', text: 'Here is the weather in philly' },
      { type: 'tool_result', name: 'lookup_weather', content: 'Nice!', tool_use_id: 'abc123' },
    ])

    assert.equal(out, 'Here is the weather in philly\n\n<tool_result>Nice!</tool_result>')
  })
})

test.describe(stringifyConverseChunkedMessage.name, {}, () => {
  test('interleaves text chunks with other types', () => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Hello' },
      { image: { format: 'gif', source: { bytes: new Uint8Array([]) } } },
      { text: 'world' }
    ])

    assert.equal(out, 'Hello\n\n<image>\n\nworld')
  })

  test('stringifies json chunks', (t) => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Here is a structured response' },
      { json: { foo: 'bar', baz: 'abc' } },
    ])

    assert.equal(out, 'Here is a structured response\n\n<json>{"foo":"bar","baz":"abc"}</json>')
  })

  test('adds a placeholder for unrecognized chunk types', (t) => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Hello' },
      { type: 'direct_neural_upload', data: 'V2hhdCBzaG91bGQgSSBtYWtlIGZvciBkaW5uZXI/' },
      { text: 'world' }
    ])

    assert.equal(out, 'Hello\n\n<unknown_chunk>\n\nworld')
  })

  test('adds information about tool calls', (t) => {
    const out = stringifyConverseChunkedMessage([
      { text: 'I will look up the weather in Philly' },
      { toolUse: { name: 'lookup_weather', toolUseId: 'abc123', input: { location: 'Philly' } } },
    ])

    assert.equal(out, 'I will look up the weather in Philly\n\n<tool_use>lookup_weather</tool_use>')
  })

  test('adds information about tool results', (t) => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Here is the weather in philly' },
      { toolResult: { toolUseId: 'abc123', content: [{ text: 'Nice!' }] } },
    ])

    assert.equal(out, 'Here is the weather in philly\n\n<tool_result>Nice!</tool_result>')
  })

  test('tool results can have nested chunks', (t) => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Here is the weather in philly' },
      {
        toolResult: {
          toolUseId: 'abc123',
          content: [
            { text: 'Nice!' },
            { image: { format: 'gif', source: { bytes: new Uint8Array([]) } } },
            { text: 'Have a picture of a sunny day!' }
          ]
        }
      },
    ])

    // This isn't the prettiest layout but this whole chunk-stringification effort is hopefully only a stopgap until we have better first-class tool support
    assert.equal(out, `
Here is the weather in philly\n
<tool_result>Nice!\n
<image>\n
Have a picture of a sunny day!</tool_result>
`.trim())
  })

  test('tool results will not infinitely recurse', (t) => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Here is the weather in atlantis' },
      {
        toolResult: {
          toolUseId: 'abc123',
          content: [
            {
              toolResult: {
                toolUseId: 'xyz987',
                content: [
                  { text: 'This is confusing' }
                ]
              }
            }
          ]
        }
      },
    ])

    // This shouldn't happen in normal usage. It's just a guard
    assert.equal(out, 'Here is the weather in atlantis\n\n<tool_result></tool_result>'.trim())
  })

  test('adds information about embedded documents', (t) => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Please describe this document' },
      { document: { format: 'pdf', name: 'report.pdf', source: { bytes: new Uint8Array([]) } } },
    ])

    assert.equal(out, 'Please describe this document\n\n<document>report.pdf</document>')
  })

  test('adds information about guards', () => {
    const out = stringifyConverseChunkedMessage([
      { text: 'The user said their name is' }, { guardContent: { text: 'Robert\');DROP TABLE Students;--' } }
    ])

    assert.equal(out, "The user said their name is\n\n<guard_content>Robert');DROP TABLE Students;--</guard_content>")
  })

  test('handles empty chunks array', () => {
    const out = stringifyConverseChunkedMessage([])
    assert.equal(out, '')
  })

  test('handles single text chunk', () => {
    const out = stringifyConverseChunkedMessage([{ text: 'Hello world' }])
    assert.equal(out, 'Hello world')
  })

  test('handles empty text chunk', () => {
    const out = stringifyConverseChunkedMessage([{ text: '' }])
    assert.equal(out, '')
  })

  test('handles image chunk without format', () => {
    const out = stringifyConverseChunkedMessage([
      { image: { source: { bytes: new Uint8Array([]) } } }
    ])
    assert.equal(out, '<image>')
  })

  test('handles document chunk without name', () => {
    const out = stringifyConverseChunkedMessage([
      { document: { format: 'pdf', source: { bytes: new Uint8Array([]) } } }
    ])
    assert.equal(out, '<document></document>')
  })

  test('handles document chunk with empty name', () => {
    const out = stringifyConverseChunkedMessage([
      { document: { format: 'pdf', name: '', source: { bytes: new Uint8Array([]) } } }
    ])
    assert.equal(out, '<document></document>')
  })

  test('handles toolUse chunk without name', () => {
    const out = stringifyConverseChunkedMessage([
      { toolUse: { toolUseId: 'abc123', input: { location: 'Test' } } }
    ])
    assert.equal(out, '<tool_use></tool_use>')
  })

  test('handles toolUse chunk with null toolUse object', () => {
    const out = stringifyConverseChunkedMessage([
      { toolUse: null }
    ])
    assert.equal(out, '<tool_use></tool_use>')
  })

  test('handles json chunk with empty object', () => {
    const out = stringifyConverseChunkedMessage([
      { json: {} }
    ])
    assert.equal(out, '<json>{}</json>')
  })

  test('handles json chunk with null value', () => {
    const out = stringifyConverseChunkedMessage([
      { json: null }
    ])
    assert.equal(out, '<json>null</json>')
  })

  test('handles json chunk with special characters', () => {
    const out = stringifyConverseChunkedMessage([
      { json: { message: 'Hello "world"', newline: 'Line 1\nLine 2' } }
    ])
    assert.equal(out, '<json>{"message":"Hello \\"world\\"","newline":"Line 1\\nLine 2"}</json>')
  })

  test('handles toolResult chunk without content', () => {
    const out = stringifyConverseChunkedMessage([
      { toolResult: { toolUseId: 'abc123' } }
    ])
    assert.equal(out, '<tool_result></tool_result>')
  })

  test('handles toolResult chunk with empty content array', () => {
    const out = stringifyConverseChunkedMessage([
      { toolResult: { toolUseId: 'abc123', content: [] } }
    ])
    assert.equal(out, '<tool_result></tool_result>')
  })

  test('handles toolResult chunk with null content', () => {
    const out = stringifyConverseChunkedMessage([
      { toolResult: { toolUseId: 'abc123', content: null } }
    ])
    assert.equal(out, '<tool_result></tool_result>')
  })

  test('handles guardContent chunk without text', () => {
    const out = stringifyConverseChunkedMessage([
      { guardContent: {} }
    ])
    assert.equal(out, '<guard_content></guard_content>')
  })

  test('handles guardContent chunk with null guardContent', () => {
    const out = stringifyConverseChunkedMessage([
      { guardContent: null }
    ])
    assert.equal(out, '<guard_content></guard_content>')
  })

  test('handles guardContent chunk with empty text', () => {
    const out = stringifyConverseChunkedMessage([
      { guardContent: { text: '' } }
    ])
    assert.equal(out, '<guard_content></guard_content>')
  })

  test('handles toolResult with mixed content including filtered toolUse and toolResult', () => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Processing request' },
      {
        toolResult: {
          toolUseId: 'abc123',
          content: [
            { text: 'Starting analysis' },
            { toolUse: { name: 'nested_tool', toolUseId: 'xyz789' } }, // should be filtered
            { image: { format: 'png', source: { bytes: new Uint8Array([]) } } },
            { json: { status: 'processing' } },
            { toolResult: { toolUseId: 'nested', content: [{ text: 'nested result' }] } }, // should be filtered
            { text: 'Analysis complete' }
          ]
        }
      }
    ])

    assert.equal(out, 'Processing request\n\n<tool_result>Starting analysis\n\n<image>\n\n<json>{"status":"processing"}</json>\n\nAnalysis complete</tool_result>')
  })

  test('handles completely empty object chunk', () => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Before' },
      {}, // completely empty object
      { text: 'After' }
    ])
    assert.equal(out, 'Before\n\n<unknown_chunk>\n\nAfter')
  })

  test('handles multiple unknown chunk types', () => {
    const out = stringifyConverseChunkedMessage([
      { text: 'Start' },
      { unknownType1: 'data1' },
      { unknownType2: 'data2' },
      { text: 'End' }
    ])
    assert.equal(out, 'Start\n\n<unknown_chunk>\n\n<unknown_chunk>\n\nEnd')
  })
})
