/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('node:http')

module.exports = openaiMockServer

const RESPONSES = {
  'Invalid API key.': [
    {
      'Content-Type': 'application/json; charset=utf-8',
      'x-request-id': '4f8f61a7d0401e42a6760ea2ca2049f6'
    },
    401,
    {
      error: {
        message:
          'Incorrect API key provided: invalid. You can find your API key at https://platform.openai.com/account/api-keys.',
        type: 'invalid_request_error',
        param: 'null',
        code: 'invalid_api_key'
      }
    }
  ],

  'Embedded: Invalid API key.': [
    {
      'Content-Type': 'application/json; charset=utf-8',
      'x-request-id': '4f8f61a7d0401e42a6760ea2ca2049f6'
    },
    401,
    {
      error: {
        message:
          'Incorrect API key provided: DEADBEEF. You can find your API key at https://platform.openai.com/account/api-keys.',
        type: 'invalid_request_error',
        param: 'null',
        code: 'invalid_api_key'
      }
    }
  ],

  'Model does not exist.': [
    {
      'Content-Type': 'application/json',
      'x-request-id': 'cfdf51fb795362ae578c12a21796262c'
    },
    404,
    {
      error: {
        message: 'The model `does-not-exist` does not exist',
        type: 'invalid_request_error',
        param: 'null',
        code: 'model_not_found'
      }
    }
  ],

  'This is an embedding test.': [
    {
      'Content-Type': 'application/json',
      'openai-organization': 'new-relic-nkmd8b',
      'openai-processing-ms': '54',
      'openai-version': '2020-10-01',
      'x-ratelimit-limit-requests': '200',
      'x-ratelimit-limit-tokens': '150000',
      'x-ratelimit-remaining-requests': '197',
      'x-ratelimit-remaining-tokens': '149994',
      'x-ratelimit-reset-requests': '19m45.394s',
      'x-ratelimit-reset-tokens': '2ms',
      'x-request-id': 'c70828b2293314366a76a2b1dcb20688'
    },
    200,
    {
      data: [
        {
          embedding:
            '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',
          index: 0,
          object: 'embedding'
        }
      ],
      model: 'text-embedding-ada-002-v2',
      object: 'list',
      usage: { prompt_tokens: 6, total_tokens: 6 }
    }
  ],

  'You are a scientist.': [
    {
      'Content-Type': 'application/json',
      'openai-model': 'gpt-3.5-turbo-0613',
      'openai-organization': 'new-relic-nkmd8b',
      'openai-processing-ms': '1469',
      'openai-version': '2020-10-01',
      'x-ratelimit-limit-requests': '200',
      'x-ratelimit-limit-tokens': '40000',
      'x-ratelimit-remaining-requests': '199',
      'x-ratelimit-remaining-tokens': '39940',
      'x-ratelimit-reset-requests': '7m12s',
      'x-ratelimit-reset-tokens': '90ms',
      'x-request-id': '49dbbffbd3c3f4612aa48def69059ccd'
    },
    200,
    {
      choices: [
        {
          finish_reason: 'stop',
          index: 0,
          message: {
            content: '212 degrees Fahrenheit is equal to 100 degrees Celsius.',
            role: 'assistant'
          }
        }
      ],
      created: 1696888863,
      id: 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTemv',
      model: 'gpt-3.5-turbo-0613',
      object: 'chat.completion',
      usage: { completion_tokens: 11, prompt_tokens: 53, total_tokens: 64 }
    }
  ],

  'You are a mathematician.': [
    {
      'Content-Type': 'application/json',
      'openai-model': 'gpt-3.5-turbo-0613',
      'openai-organization': 'new-relic-nkmd8b',
      'openai-processing-ms': '1469',
      'openai-version': '2020-10-01',
      'x-ratelimit-limit-requests': '200',
      'x-ratelimit-limit-tokens': '40000',
      'x-ratelimit-remaining-requests': '199',
      'x-ratelimit-remaining-tokens': '39940',
      'x-ratelimit-reset-requests': '7m12s',
      'x-ratelimit-reset-tokens': '90ms',
      'x-request-id': '49dbbffbd3c3f4612aa48def69059aad'
    },
    200,
    {
      choices: [
        {
          finish_reason: 'stop',
          index: 0,
          message: {
            content: '1 plus 2 is 3.',
            role: 'assistant'
          }
        }
      ],
      created: 1696888865,
      id: 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat',
      model: 'gpt-3.5-turbo-0613',
      object: 'chat.completion',
      usage: { completion_tokens: 11, prompt_tokens: 53, total_tokens: 64 }
    }
  ]
}

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
  let body = ''

  req.on('data', (data) => {
    body += data.toString('utf8')
  })

  req.on('end', () => {
    const payload = JSON.parse(body)
    const prompt = getShortenedPrompt(payload)

    if (Object.hasOwnProperty.call(RESPONSES, prompt) === false) {
      res.statusCode = 500
      res.write(`Unknown prompt:\n${prompt}`)
      res.end()
      return
    }

    const [headers, code, response] = RESPONSES[prompt]

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value)
    }
    res.statusCode = code
    res.write(JSON.stringify(response))
    res.end()
  })
}

function getShortenedPrompt(reqBody) {
  const prompt =
    reqBody.prompt || reqBody.input || reqBody.messages.map((m) => m.content).join('\n')

  return prompt.split('\n')[0]
}
