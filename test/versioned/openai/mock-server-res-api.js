/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = openaiMockServer

const http = require('node:http')
const RESPONSES = require('./mock-responses-api-responses')
const chunks = require('./stream-chunks-res-api')
const { Readable } = require('node:stream')

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

    const { headers, code, body, streamData } = RESPONSES.get(prompt)
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value)
    }
    res.statusCode = code

    if (payload.stream === true) {
      let outStream
      if (streamData !== 'bad stream') {
        outStream = finiteStream()
        outStream.pipe(res)
      } else {
        // Simulate a server-side error for a bad stream request
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        const errorResponse = {
          error: {
            message: 'fetch failed',
            type: 'server_error',
            param: null,
            code: 500
          }
        }
        res.write(JSON.stringify(errorResponse))
        res.end()
      }
    } else {
      res.write(JSON.stringify(body))
      res.end()
    }
  })
}

/**
 * Returns a stream that sends `chunks`
 * as OpenAI v5 data stream messages. This stream
 * has a finite number of messages that will be sent.
 *
 * @returns {Readable} A paused stream.
 */
function finiteStream() {
  return new Readable({
    read() {
      // This is how the data is streamed from openai
      for (let i = 0; i < chunks.length; i++) {
        const chunkString = JSON.stringify(chunks[i])
        this.push(`data: ${chunkString}\n\n`)
      }
      this.push('data: [DONE]\n\n')
      this.push(null)
    }
  }).pause()
}

function getShortenedPrompt(reqBody) {
  const prompt = reqBody.input?.[0]?.content || reqBody.input?.badContent || reqBody.input

  return prompt.split('\n')[0]
}
