/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = openaiMockServer

const http = require('node:http')
const { Readable } = require('node:stream')
const RESPONSES = require('./openai-responses')

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
 * const res = await client.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'You are a scientist.' }]
 * })
 * console.dir(res)
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
      // OpenAI streamed responses are double newline delimited lines that
      // are prefixed with the string `data: `. The end of the stream is
      // terminated with a `done: [DONE]` string.
      const parts = body.split(' ')
      let i = 0
      const outStream = new Readable({
        read() {
          if (i < parts.length) {
            const content = parts.length - 1 === i ? parts[i] : `${parts[i]} `
            const chunk = JSON.stringify({
              id: 'chatcmpl-8MzOfSMbLxEy70lYAolSwdCzfguQZ',
              object: 'chat.completion.chunk',
              // 2023-11-20T09:00:00-05:00
              created: 1700488800,
              model: 'gpt-4',
              choices: [
                {
                  index: 0,
                  finish_reason: null,
                  delta: { role: 'assistant', content }
                }
              ]
            })
            this.push(`data: ${chunk}\n\n`)
            i += 1
          } else {
            this.push('data: [DONE]\n\n')
            this.push(null)
          }
        }
      })
      outStream.pipe(res)
    } else {
      res.write(JSON.stringify(body))
      res.end()
    }
  })
}

function getShortenedPrompt(reqBody) {
  const prompt =
    reqBody.prompt || reqBody.input || reqBody.messages.map((m) => m.content).join('\n')

  return prompt.split('\n')[0]
}
