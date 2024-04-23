/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = createAiResponseServer

const http = require('http')
const crypto = require('crypto')
const { Readable } = require('stream')
const { EventStreamCodec } = require('@smithy/eventstream-codec')
const { toUtf8, fromUtf8 } = require('@smithy/util-utf8')
const responses = require('./responses')

/**
 * Creates a new HTTP server to serve responses for Amazon AI requests
 * (i.e. the Bedrock API). The returned server is listening on `localhost`
 * and a random port.
 *
 * @returns {Promise<object>} Has `server`, `host`, `port`, `baseUrl`,
 * and `responses` properties.
 */
function createAiResponseServer() {
  const server = http.createServer(handler)
  const sockets = new Set()

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  server.destroy = function destroy() {
    sockets.forEach((s) => s.destroy())
    server.close()
  }

  return new Promise((resolve, reject) => {
    server.listen({ host: '127.0.0.1', port: 0 }, (error) => {
      if (error) {
        return reject(error)
      }

      const addy = server.address()
      return resolve({
        server,
        host: addy.address,
        port: addy.port,
        baseUrl: `http://${addy.address}:${addy.port}`,
        responses
      })
    })
  })
}

function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 400
    res.end()
    return
  }

  let data = Buffer.alloc(0)
  req.on('data', (chunk) => {
    data = Buffer.concat([data, chunk])
  })

  req.on('end', () => {
    const payload = JSON.parse(data.toString('utf8'))

    // Available  model identifiers are listed at:
    // https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
    const [, model] = /model\/(.+)\/invoke/.exec(req.url)
    let response
    switch (model) {
      case 'ai21.j2-mid-v1':
      case 'ai21.j2-ultra-v1': {
        response = responses.ai21.get(payload.prompt)
        break
      }

      case 'amazon.titan-text-express-v1':
      case 'amazon.titan-embed-text-v1': {
        response = responses.amazon.get(payload.inputText)
        break
      }

      case 'anthropic.claude-v1':
      case 'anthropic.claude-instant-v1':
      // v1 seems to be the same as v2, just with less helpful responses.
      case 'anthropic.claude-v2':
      case 'anthropic.claude-v2:1': {
        response = responses.claude.get(payload.prompt)
        break
      }

      case 'cohere.command-text-v14':
      case 'cohere.command-light-text-v14': {
        response = responses.cohere.get(payload.prompt)
        break
      }

      case 'cohere.embed-english-v3':
      case 'cohere.embed-multilingual-v3': {
        response = responses.cohere.get(payload.texts.join(' '))
        break
      }

      case 'meta.llama2-13b-chat-v1':
      case 'meta.llama2-70b-chat-v1': {
        response = responses.llama2.get(payload.prompt)
        break
      }

      default: {
        response = { statusCode: 418, body: {} }
      }
    }

    if (response === undefined) {
      res.statusCode = 500
      res.end('could not match prompt')
      return
    }

    res.statusCode = response.statusCode
    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value)
    }

    if (response.body === 'bad stream') {
      const stream = infiniteStream()
      let count = 0
      stream.on('data', () => {
        if (count >= 100) {
          stream.destroy()
          res.destroy()
        }
        count += 1
      })
      stream.pipe(res)
      return
    } else if (response.headers['content-type'].endsWith('amazon.eventstream') === true) {
      encodeChunks(response.chunks).pipe(res)
      return
    }

    res.end(JSON.stringify(response.body))
  })
}

/**
 * Creates a stream that will generate new stream messages until the stream
 * is destroyed.
 *
 * @returns {Readable}
 */
function infiniteStream() {
  return new Readable({
    read(size = 16) {
      const data = crypto.randomBytes(size)
      this.push(JSON.stringify({ chunk: { bytes: data.toString('base64') } }))
    }
  }).pause()
}

/**
 * @typedef {object} BedrockModelResponse
 * @property {string} completion A full, or partial, model response.
 * @property {string|null} stop_reason Indicates why this response object
 * should be the end of the response. Should be `null` if there are more
 * objects to receive, otherwise is likely set to "stop_sequence".
 * @property {string|null} stop When not `null`, indicates that this object
 * is the last object in the response.
 * @property {object} [amazon-bedrock-invocationMetrics] Should be present on the
 * final response object in a streamed response. Has properties:
 * `inputTokenCount`, `outputTokenCount`, `invocationLatency`, and
 * `firstByteLatency` (all integers).
 */

/**
 * @typedef {object} BedrockStreamChunk
 * @property {BedrockModelResponse} body A plain JavaScript object that
 * constitutes a response from the model.
 * @property {object} headers An object with keys that are header names and
 * values that are objects with keys `type` and `value`. The `type` is any
 * listed at https://github.com/smithy-lang/smithy-typescript/blob/9485a73/packages/eventstream-codec/src/HeaderMarshaller.ts#L30.
 * The `value` is the value of the header.
 */

/**
 * Encodes a set of {@link BedrockStreamChunk} objects into binary packed
 * message objects that can be sent as a streamed response. The binary
 * format is mainly handled by the `EventStreamCodec` object from the AWS
 * tooling, but understanding the format is likely beneficial to anyone
 * reading this. The basics of the format are:
 *
 * 1. A 16 byte prelude starts each message. The first 4 bytes are a big endian
 * uint32 representing the message length. The second 4 bytes are another
 * uint32 representing the headers length. The third 4 bytes are a CRC32
 * checksum for the first 8 bytes.
 * 2. The message length _includes_ all 16 bytes of the prelude block, the
 * encoded headers block, and the encoded body block.
 * 3. The whole message is terminated with a 4 byte CRC32 checksum value of
 * the whole message.
 * 4. The encoded headers block starts with the vertical tab byte 0x0b followed
 * by an alternating set of: string (header name), 3 byte descriptor (leftmost
 * byte being an indicator of the header type, e.g. 0x07 for "string", and the
 * two remaining bytes an integer indicating the length of the value), the
 * value of the header (e.g. a string for a string header), and a terminating
 * byte set to 0x0d _except_ for the final header where there is not a
 * terminating byte.
 * 5. The encoded body block is a JSON string that represents an object with a
 * `bytes` key set to a base64 encoded JSON representation of a
 * {@link BedrockModelResponse} object. This block is added without any preamble
 * or trailer.
 * 6. The 4 byte whole message checksum.
 *
 * Messages in the data stream are not separated in any way. Each 4 byte message
 * length is used to demarcate each message. Note that there may be some
 * incorrect assumptions in the format description; we have not found any actual
 * documentation on the format and had to derive it from network inspection and
 * reversing of the parsing algorithm.
 *
 * @param {BedrockStreamChunk[]} chunks The chunks to encode.
 * @returns {Readable} A paused stream that will write one coded chunk per
 * read operation.
 */
function encodeChunks(chunks) {
  const encodedChunks = []
  const codec = new EventStreamCodec(toUtf8, fromUtf8)

  for (const chunk of chunks) {
    const b64Body = Buffer.from(JSON.stringify(chunk.body)).toString('base64')
    const bytesObj = JSON.stringify({ bytes: b64Body })
    const bodyBuffer = Buffer.from(bytesObj)
    const toEncode = {
      headers: chunk.headers,
      body: new Uint8Array(bodyBuffer, 0, bodyBuffer.byteLength)
    }
    encodedChunks.push(codec.encode(toEncode))
  }

  return new Readable({
    read() {
      if (encodedChunks.length > 0) {
        this.push(encodedChunks.shift())
      } else {
        this.push(null)
      }
    }
  }).pause()
}

module.exports.internals = {
  encodeChunks
}
