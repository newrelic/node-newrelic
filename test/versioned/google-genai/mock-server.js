/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = GoogleGenAIMockServer

const http = require('node:http')
const RESPONSES = require('./mock-responses')

/**
 * Build a mock server that listens on a 127.0.0.1 and a random port that
 * responds with pre-defined responses based on the "prompt" sent by the
 * Google GenAI client library.
 *
 * @example
 * const { server, host, port } = await GoogleGenAIMockServer()
 * const client = new GoogleGenAI({
 *   apiKey: 'some gemini api key',
 *   baseURL: `http://${host}:${port}`
 *  }
 *
 * const res = await client.models.generateContent({
 *   model: 'gemini-2.0-flash',
 *   contents: 'You are a scientist.'
 * })
 * res.json({ text: response.text })
 *
 * server.close()
 *
 * @returns {Promise<object>} Has `server`, `host`, and `port` properties.
 */
async function GoogleGenAIMockServer() {
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
    const prompt = getShortenedPrompt(payload)

    if (RESPONSES.has(prompt) === false) {
      res.statusCode = 500
      res.write(`Unknown prompt:\n${prompt}`)
      res.end()
      return
    }

    const { code, body } = RESPONSES.get(prompt)
    res.statusCode = code

    if (prompt.toLowerCase().includes('stream')) {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Transfer-Encoding', 'chunked')

      // Simulate streaming chunks
      const streamData = body

      // SSE format: data: {json}\r\n\r\n
      if (prompt.toLowerCase().includes('bad')) {
        const errorObj = {
          error: {
            status: 'INTERNAL',
            code: 500,
            message: 'bad stream'
          }
        }
        res.write(JSON.stringify(errorObj))
      } else res.write('data: ' + JSON.stringify(streamData) + '\r\n\r\n')

      // Do not write any extra data after the last chunk
      res.end()
    } else {
      res.write(JSON.stringify(body))
      res.end()
    }
  })
}

function getShortenedPrompt(reqBody) {
  try {
    const prompt = reqBody.contents?.[0]?.parts?.[0]?.text ||
      reqBody.requests?.[0]?.content?.parts?.[0]?.text

    return prompt.split('\n')[0]
  } catch {
    return ''
  }
}
