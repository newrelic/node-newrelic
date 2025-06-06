/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = openaiMockServer

const http = require('node:http')
const RESPONSES = require('./mock-responses-api-responses')

/**
 * Build a mock server that listens on a 127.0.0.1 and a random port that
 * responds with pre-defined responses based on the "prompt" sent by the
 * OpenAI client library.
 *
 * @example
 * const { server, port } = await openaiMockServer()
 * const client = new OpenAI({
 *   baseURL: `http://127.0.0.1:${port}`,
 *   apiKey: 'some key'
 *  }
 *
 * const res = await client.responses.create({
 *   model: 'gpt-4',
 *   input: 'You are a scientist.'
 * })
 * console.log(response.output_text);
 *
 * server.close()
 *
 * @returns {Promise<object>} Has `server`, `host`, and `port` properties.
 */
async function openaiMockServer() {
  const server = http.createServer(handler)

  return new Promise((resolve) => {
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      return resolve({
        server,
        host: server.address().address,
        port: server.address().port
      })
    })
  })
}

function handler(req, res) {
  let receivedData = ''

  req.on('data', (data) => {
    receivedData += data.toString('utf8')
  })

  req.on('end', () => {
    const payload = JSON.parse(receivedData)
    const prompt = getShortenedPrompt(payload)

    if (RESPONSES.has(prompt) === false) {
      res.statusCode = 500
      res.write(`Unknown prompt:\n${prompt}`)
      res.end()
      return
    }

    const { headers, code, body } = RESPONSES.get(prompt)
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value)
    }
    res.statusCode = code

    if (payload.stream === true) {
      res.statusCode = 500
      res.write('Streaming is not yet supported in this mock server.')
      res.end()
    } else {
      res.write(JSON.stringify(body))
      res.end()
    }
  })
}

function getShortenedPrompt(reqBody) {
  const prompt = reqBody.input?.[0]?.content || reqBody.input

  return prompt.split('\n')[0]
}
