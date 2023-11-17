
/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { assertSegments } = require('../../lib/metrics_helper')
const responses = require('./mock-responses')
const { beforeHook, afterEachHook, afterHook, assertChatCompletionMessages, assertChatCompletionSummary } = require('./common')
const semver = require('semver')
const fs = require('fs')
// have to read and not require because openai does not export the package.json
const { version: pkgVersion } = JSON.parse(fs.readFileSync(`${__dirname}/node_modules/openai/package.json`)) 

tap.Test.prototype.addAssert('llmMessages', 1, assertChatCompletionMessages)
tap.Test.prototype.addAssert('llmSummary', 1, assertChatCompletionSummary)

tap.test('OpenAI instrumentation - chat completions', (t) => {
  t.autoend()

  t.before(beforeHook.bind(null, t))

  t.afterEach(afterEachHook.bind(null, t))

  t.teardown(afterHook.bind(null, t))

  t.test('should create span on successful chat completion create', (test) => {
    const { client, agent, host, port } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const results = await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      test.notOk(results.headers, 'should remove response headers from user result')
      test.notOk(results.api_key, 'should remove api_key from user result')
      test.equal(results.choices[0].message.content, '1 plus 2 is 3.')

      test.doesNotThrow(() => {
        assertSegments(
          tx.trace.root,
          ['AI/OpenAI/Chat/Completions/Create', [`External/${host}:${port}/chat/completions`]],
          { exact: false }
        )
      }, 'should have expected segments')
      tx.end()
      test.end()
    })
  })

  t.test('should create chat completion message and summary for every message sent', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const model = 'gpt-3.5-turbo-0613'
      const content = 'You are a mathematician.'
      await client.chat.completions.create({
        max_tokens: 100,
        temperature: 0.5,
        model,
        messages: [
          { role: 'user', content },
          { role: 'user', content: 'What does 1 plus 1 equal?' }
        ]
      })

      const events = agent.customEventAggregator.events.toArray()
      test.equal(events.length, 4, 'should create a chat completion message and summary event')
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      test.llmMessages({ tx, chatMsgs, model, id: 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat', resContent: '1 plus 2 is 3.', reqContent: content })

      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      test.llmSummary({ tx, model, chatSummary, tokenUsage: true })
      tx.end()
      test.end()
    })
  })
  
  if (semver.gte(pkgVersion, '4.12.2')) {
    t.test('should create span on successful chat completion stream create', (test) => {
      const { client, agent, host, port } = t.context
      helper.runInTransaction(agent, async (tx) => {
        const content = 'Streamed response'
        const stream = await client.chat.completions.create({
          stream: true,
          messages: [{ role: 'user', content }]
        })

        let chunk = {}
        let res = ''
        for await (chunk of stream) {
          res += chunk.choices[0]?.delta?.content
        }
        test.notOk(chunk.headers, 'should remove response headers from user result')
        test.notOk(chunk.api_key, 'should remove api_key from user result')
        test.equal(chunk.choices[0].message.role, 'assistant')
        const expectedRes = responses.get(content)
        test.equal(chunk.choices[0].message.content, expectedRes.streamData) 
        test.equal(chunk.choices[0].message.content, res)

        test.doesNotThrow(() => {
          assertSegments(
            tx.trace.root,
            ['AI/OpenAI/Chat/Completions/Create', [`External/${host}:${port}/chat/completions`]],
            { exact: false }
          )
        }, 'should have expected segments')
        tx.end()
        test.end()
      })
    })

    t.test('should create chat completion message and summary for every message sent in stream', (test) => {
      const { client, agent } = t.context
      helper.runInTransaction(agent, async (tx) => {
        const content = 'Streamed response'
        const model = 'gpt-4'
        const stream = await client.chat.completions.create({
          max_tokens: 100,
          temperature: 0.5,
          model,
          messages: [
            { role: 'user', content },
            { role: 'user', content: 'What does 1 plus 1 equal?' }
          ],
          stream: true
        })
        
        let res = ''

        for await (const chunk of stream) {
          res += chunk.choices[0]?.delta?.content
        }
        

        const events = agent.customEventAggregator.events.toArray()
        test.equal(events.length, 4, 'should create a chat completion message and summary event')
        const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
        test.llmMessages({ tx, chatMsgs, id: 'chatcmpl-8MzOfSMbLxEy70lYAolSwdCzfguQZ', model, resContent: res, reqContent: content  })

        const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
        test.llmSummary({ tx, model, chatSummary })
        tx.end()
        test.end()
      })
    })
  }

  t.test(
    'should spread metadata across events if present on agent.llm.metadata',
    (test) => {
      const { client, agent } = t.context
      const api = helper.getAgentApi()
      helper.runInTransaction(agent, async (tx) => {
        const meta = { key: 'value', extended: true, vendor: 'overwriteMe', id: 'bogus' }
        api.setLlmMetadata(meta)

        await client.chat.completions.create({
          messages: [{ role: 'user', content: 'You are a mathematician.' }]
        })

        const events = agent.customEventAggregator.events.toArray()
        events.forEach(([, testEvent]) => {
          test.equal(testEvent.key, 'value')
          test.equal(testEvent.extended, true)
          test.equal(
            testEvent.vendor,
            'openAI',
            'should not override properties of message with metadata'
          )
          test.not(testEvent.id, 'bogus', 'should not override properties of message with metadata')
        })
        tx.end()
        test.end()
      })
    }
  )

  t.test('should not create llm events when not in a transaction', async (test) => {
    const { client, agent } = t.context
    await client.chat.completions.create({
      messages: [{ role: 'user', content: 'You are a mathematician.' }]
    })

    const events = agent.customEventAggregator.events.toArray()
    test.equal(events.length, 0, 'should not create llm events')
  })

})
