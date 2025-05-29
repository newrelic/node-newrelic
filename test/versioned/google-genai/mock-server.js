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
 * res.json({ text: response.text })
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

    const { code, body } = RESPONSES.get(prompt)
    res.statusCode = code

    if (prompt.toLowerCase().includes('stream')) {
      const streamData = body.candidates[0].content.parts[0].text
      let asyncGen
      if (streamData !== 'do random') {
        asyncGen = finiteAsyncGen(streamData, { ...body })
      } else {
        asyncGen = randomAsyncGen({ ...body })
      }
      // return asyncGen

      // Write each chunk from the async iterator to the response
      (async () => {
        try {
          for await (const chunk of asyncGen) {
            if (chunk?.text) res.write(chunk.text)
          }
          res.end()
        } catch (err) {
          res.destroy(err)
        }
      })()
    } else {
      res.write(JSON.stringify(body))
      res.end()
    }
  })
}

/**
 * Mocks the Google GenAI streaming API by returning a Promise that resolves
 * to an async generator, which yields response chunks as the real API would.
 *
 * @param {string} dataToStream The string to split and stream.
 * @param {object} chunkTemplate The template for each chunk.
 * @returns {object} An async generator that yields chunks of data.
 */
function finiteAsyncGen(dataToStream, chunkTemplate) {
  const parts = dataToStream.split(' ')
  const asyncGen = (async function * () {
    for (let i = 0; i < parts.length; i++) {
      const content = i === parts.length - 1 ? parts[i] : `${parts[i]} `
      const chunk = chunkTemplate
      chunk.candidates[0].content.parts[0].text = content
      chunk.text = content
      yield chunk
    }
    // End the stream
    yield undefined
  })()
  return asyncGen
}

/**
 * Creates a stream that will stream an infinite number of GoogleGenAI stream data
 * chunks using an async generator.
 *
 * @param {object} chunkTemplate An object that is shaped like a GoogleGenAI stream
 * data object.
 * @returns {object} An async generator that yields chunks of data.
 */
function randomAsyncGen(chunkTemplate) {
  const asyncGen = (async function * () {
    while (true) {
      const data = crypto.randomBytes(16)
      // Deep clone to avoid mutating the original template
      const chunk = JSON.parse(JSON.stringify(chunkTemplate))
      chunk.value.candidates[0].content.parts[0].text = data.toString('base64')
      yield chunk
    }
  })()
  return asyncGen
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
