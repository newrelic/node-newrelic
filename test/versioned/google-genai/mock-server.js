/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = GoogleGenAIMockServer

const http = require('node:http')
const { Readable } = require('node:stream')
const RESPONSES = require('./mock-responses')
const crypto = require('crypto')

/**
 * Build a mock server that listens on a 127.0.0.1 and a random port that
 * responds with pre-defined responses based on the "prompt" sent by the
 * Google GenAI client library.
 *
 * @example
 * const { server, port } = await GoogleGenAIMockServer()
 * const client = new GoogleGenAI({
 *   vertexai: false
 *   apiKey: 'some gemini api key'
 *  }
 *
 * const res = await client.models.generateContent({
 *   model: 'gemini-2.0-flash',
 *   contents: 'You are a scientist.'
 * })
 * console.dir(res)
 *
 * server.close()
 *
 * @returns {Promise<object>} Has `server`, `host`, and `port` properties.
 */
async function GoogleGenAIMockServer() {
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

    const { code, body, streamData } = RESPONSES.get(prompt)
    res.statusCode = code

    if (payload.stream === true) {
      // GoogleGenAI streamed responses are double newline delimited lines that
      // are prefixed with the string `data: `. The end of the stream is
      // terminated with a `done: [DONE]` string.
      let outStream
      if (streamData !== 'do random') {
        outStream = finiteStream(streamData, { ...body })
      } else {
        outStream = randomStream({ ...body })
        let streamChunkCount = 0
        outStream.on('data', () => {
          if (streamChunkCount >= 100) {
            outStream.destroy()
            res.destroy()
          }
          streamChunkCount += 1
        })
      }

      outStream.pipe(res)
    } else {
      res.write(JSON.stringify(body))
      res.end()
    }
  })
}

/**
 * Splits the provided `dataToStream` into chunks and returns a stream that
 * sends those chunks as GoogleGenAI data stream messages. This stream has a finite
 * number of messages that will be sent.
 *
 * @param {string} dataToStream A fairly long string to split on space chars.
 * @param {object} chunkTemplate An object that is shaped like an GoogleGenAI stream
 * data object.
 * @returns {Readable} A paused stream.
 */
function finiteStream(dataToStream, chunkTemplate) {
  const parts = dataToStream.split(' ')
  let i = 0
  return new Readable({
    read() {
      // This is how the data is streamed from GoogleGenAI
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
  }).pause()
}

/**
 * Creates a stream that will stream an infinite number of GoogleGenAI stream data
 * chunks.
 *
 * @param {object} chunkTemplate An object that is shaped like an GoogleGenAI stream
 * data object.
 * @returns {Readable} A paused stream.
 */
function randomStream(chunkTemplate) {
  return new Readable({
    read(size = 16) {
      const data = crypto.randomBytes(size)
      chunkTemplate.candidates[0].delta.content = data.toString('base64')
      this.push('data: ' + JSON.stringify(chunkTemplate) + '\n\n')
    }
  }).pause()
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
