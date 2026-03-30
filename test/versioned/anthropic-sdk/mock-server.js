/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = AnthropicMockServer

const http = require('node:http')
const RESPONSES = require('./mock-responses')

/**
 * Build a mock server that listens on 127.0.0.1 and a random port that
 * responds with pre-defined responses based on the prompt sent by the
 * Anthropic SDK client library.
 *
 * @example
 * const { server, host, port } = await AnthropicMockServer()
 * const client = new Anthropic({
 *   apiKey: 'fake-api-key',
 *   baseURL: `http://${host}:${port}`
 * })
 *
 * const res = await client.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   max_tokens: 100,
 *   messages: [{ role: 'user', content: 'You are a mathematician.' }]
 * })
 *
 * server.close()
 *
 * @returns {Promise<object>} Has `server`, `host`, and `port` properties.
 */
async function AnthropicMockServer() {
  const server = http.createServer(handler)

  return new Promise((resolve) => {
    server.listen({ host: '127.0.0.1', port: 0 }, () => resolve({
      server,
      host: server.address().address,
      port: server.address().port
    }))
  })
}

function handler(req, res) {
  let receivedData = ''

  req.on('data', (data) => {
    receivedData += data.toString('utf8')
  })

  req.on('end', () => {
    const payload = JSON.parse(receivedData)
    const prompt = getPrompt(payload)

    if (RESPONSES.has(prompt) === false) {
      res.statusCode = 500
      res.write(`Unknown prompt:\n${prompt}`)
      res.end()
      return
    }

    const { code, body } = RESPONSES.get(prompt)
    res.statusCode = code

    if (payload.stream === true) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Transfer-Encoding', 'chunked')

      if (body === 'error') {
        // Simulate a stream error by sending malformed SSE
        res.write('event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n')
        res.end()
        return
      }

      // body should be an array of SSE events for streaming
      if (Array.isArray(body)) {
        for (const event of body) {
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        }
      }
      res.end()
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.write(JSON.stringify(body))
      res.end()
    }
  })
}

function getPrompt(reqBody) {
  try {
    const message = reqBody.messages?.[0]
    if (typeof message?.content === 'string') {
      return message.content.split('\n')[0]
    }
    if (Array.isArray(message?.content)) {
      const textBlock = message.content.find((block) => block.type === 'text')
      return textBlock?.text?.split('\n')[0] || ''
    }
    return ''
  } catch {
    return ''
  }
}
