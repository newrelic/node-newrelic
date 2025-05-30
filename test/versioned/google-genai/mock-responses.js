/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
module.exports = responses

responses.set('Invalid API key.', {
  code: 400,
  body: {
    error: {
      name: 'ClientError',
      message: '"got status: 400 Bad Request. {"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID","domain":"googleapis.com","metadata":{"service":"generativelanguage.googleapis.com"}},{"@type":"type.googleapis.com/google.rpc.LocalizedMessage","locale":"en-US","message":"API key not valid. Please pass a valid API key."}]}}"'
    }
  }
})

responses.set('Model does not exist.', {
  code: 400,
  body: {
    error: {
      message: 'got status: 400 Bad Request. {"error":{"code":400,"contents":"* GenerateContentRequest.model: unexpected model name formatn","status":"INVALID_ARGUMENT"}}'
    }
  }
})

responses.set('This is an embedding test.', {
  code: 200,
  body: {
    embeddings: [
      {
        values: [0.1, 0.2, 0.3],
      },
      {
        values: [0.4, 0.5, 0.6],
      }
    ],
  }
})

responses.set('You are a scientist.', {
  code: 200,
  body: {
    candidates: [
      {
        content: {
          parts: [
            { text: '212 degrees Fahrenheit is equal to 100 degrees Celsius.' }
          ],
          role: 'model'
        },
        finishReason: 'STOP'
      },
    ],
    modelVersion: 'gemini-2.0-flash',
    usageMetadata: { candidatesTokenCount: 11, promptTokenCount: 53, totalTokenCount: 64 }
  }
})

responses.set('You are a mathematician.', {
  code: 200,
  body: {
    candidates: [
      {
        content: {
          parts: [
            { text: '1 plus 2 is 3.' }
          ],
          role: 'model'
        },
        finishReason: 'STOP'
      },
    ],
    modelVersion: 'gemini-2.0-flash',
    usageMetadata: { candidatesTokenCount: 11, promptTokenCount: 53, totalTokenCount: 64 }
  }
})

responses.set('Embedding not allowed.', {
  code: 404,
  body: {
    error: {
      name: 'ClientError',
      message: '"got status: 404 Not Found. {\\"error\\":{\\"code\\":404,\\"message\\":\\"models/gemini-2.0-flash is not found for API version v1beta, or is not supported for embedContent. Call ListModels to see the list of available models and their supported methods.\\",\\"status\\":\\"NOT_FOUND\\"}}"',
    }
  }
})

responses.set('Streamed response', {
  code: 200,
  body: {
    candidates: [
      {
        content: {
          parts: [
            { text: "A streamed response is a way of transmitting data from a server to a client (e.g. from a website to a user's computer or mobile device) in a continuous flow or stream, rather than all at one time. This means the client can start to process the data before all of it has been received, which can improve performance for large amounts of data or slow connections. Streaming is often used for real-time or near-real-time applications like video or audio playback." }
          ],
          role: 'model'
        },
        usageMetadata: { promptTokenCount: 999, totalTokenCount: 999, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 999 }] },
        finishReason: 'STOP'
      }
    ],
    modelVersion: 'gemini-2.0-flash'
  }
})

responses.set('bad stream', {
  code: 200,
  body: {
    candidates: [
      {
        content: {
          parts: [
            { text: 'do random' }
          ],
          role: 'model'
        },
        usageMetadata: { promptTokenCount: 2, totalTokenCount: 2, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 2 }] },
        finishReason: 'STOP'
      }
    ],
    modelVersion: 'gemini-2.0-flash'
  }
})
