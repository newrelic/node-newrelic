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
})
