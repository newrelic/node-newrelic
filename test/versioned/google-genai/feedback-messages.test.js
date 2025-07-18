/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { match } = require('../../lib/custom-assertions')
const GoogleGenAIMockServer = require('./mock-server')
const helper = require('../../lib/agent_helper')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await GoogleGenAIMockServer()
  ctx.nr.host = host
  ctx.nr.port = port
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent({
    ai_monitoring: {
      enabled: true
    },
    streaming: {
      enabled: true
    }
  })
  const { GoogleGenAI } = require('@google/genai')
  ctx.nr.client = new GoogleGenAI({
    apiKey: 'fake-versioned-test-key',
    vertexai: false,
    httpOptions: {
      baseUrl: `http://${host}:${port}/`,
    },
    httpMethod: 'GET'
  })
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server?.close()
  removeModules('@google/genai')
})

test('can send feedback events', (t, end) => {
  const { client, agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, async (tx) => {
    await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'You are a mathematician.'
    })
    const { traceId } = api.getTraceMetadata()

    api.recordLlmFeedbackEvent({
      traceId,
      category: 'test-event',
      rating: '5 star',
      message: 'You are a mathematician.',
      metadata: { foo: 'foo' }
    })

    const recordedEvents = agent.customEventAggregator.getEvents()
    const hasMatchingEvents = recordedEvents.some((ele) => {
      const [info, data] = ele
      if (info.type !== 'LlmFeedbackMessage') {
        return false
      }
      try {
        match(data, {
          id: /\w{32}/,
          trace_id: traceId,
          category: 'test-event',
          rating: '5 star',
          message: 'You are a mathematician.',
          ingest_source: 'Node',
          foo: 'foo'
        })
      } catch {
        return false
      }
      return true
    })
    assert.equal(hasMatchingEvents, true)

    tx.end()
    end()
  })
})
