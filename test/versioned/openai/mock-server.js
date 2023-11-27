/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = openaiMockServer

const http = require('node:http')
const { Readable } = require('node:stream')
const RESPONSES = require('./mock-responses')
const crypto = require('crypto')

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

    const { headers, code, body, streamData } = RESPONSES.get(prompt)
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value)
    }
    res.statusCode = code

    if (payload.stream === true) {
      // OpenAI streamed responses are double newline delimited lines that
      // are prefixed with the string `data: `. The end of the stream is
      // terminated with a `done: [DONE]` string.
      const outStream =
        streamData !== 'do random' ? goodStream(streamData, { ...body }) : badStream({ ...body })
      outStream.pipe(res)
    } else {
      res.write(JSON.stringify(body))
      res.end()
    }
  })
}

function goodStream(dataToStream, chunkTemplate) {
  const parts = dataToStream.split(' ')
  let i = 0
  return new Readable({
    read() {
      // This is how the data is streamed from openai
      // The message response only seems to change and mostly
      // a stream of content changes via the delta key
      if (i < parts.length) {
        const content = parts.length - 1 === i ? parts[i] : `${parts[i]} `
        chunkTemplate.choices[0].delta.content = content
        const chunk = JSON.stringify(chunkTemplate)
        this.push(`data: ${chunk}\n\n`)
        i += 1
      } else {
        this.push('data: [DONE]\n\n')
        this.push(null)
      }
    }
  })
}

function badStream(chunkTemplate) {
  let count = 0
  return new Readable({
    read(size = 16) {
      if (count > 100) {
        // something is up with OpenAI
        // you shouldn't have to do this. a throw would be enough
        chunkTemplate.error = 'exceeded count'
        this.push('data: ' + JSON.stringify(chunkTemplate) + '\n\n')
        this.push(null)
        return
      }

      const data = crypto.randomBytes(size)
      chunkTemplate.choices[0].delta.content = data.toString('base64')
      this.push('data: ' + JSON.stringify(chunkTemplate) + '\n\n')
      count += 1
    }
  })
}

function getShortenedPrompt(reqBody) {
  const prompt =
    reqBody.prompt || reqBody.input || reqBody.messages.map((m) => m.content).join('\n')

  return prompt.split('\n')[0]
}
