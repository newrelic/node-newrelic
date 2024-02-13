/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
// load the assertSegments assertion
require('../../lib/metrics_helper')
const fs = require('fs')
// have to read and not require because openai does not export the package.json
// const { version: pkgVersion } = JSON.parse(
//   fs.readFileSync(`${__dirname}/node_modules/@langchain/core/package.json`)
// )

const { beforeHook, afterEachHook, afterHook } = require('../openai/common')

const config = {
  ai_monitoring: {
    enabled: true
  },
  feature_flag: {
    langchain_instrumentation: true
  }
}

tap.test(
  'Langchain instrumentation - chaining a prompt template and a model together with output parser',
  (t) => {
    t.autoend()

    t.before(beforeHook.bind(null, t))
    t.afterEach(afterEachHook.bind(null, t))
    t.teardown(afterHook.bind(null, t))

    t.beforeEach(async () => {
      const { client } = t.context
      const { ChatPromptTemplate } = require('@langchain/core/prompts')
      const { StringOutputParser } = require('@langchain/core/output_parsers')
      const { ChatOpenAI } = require('@langchain/openai')

      t.context.prompt = ChatPromptTemplate.fromMessages([['human', 'You are a {topic}.']])
      t.context.model = new ChatOpenAI({
        openAIApiKey: 'fake-key',
        configuration: {
          baseURL: client.baseURL
        }
      })
      t.context.outputParser = new StringOutputParser()
    })

    t.test('should create langchain events for every invoke call', (test) => {
      const { agent, prompt, outputParser, model } = t.context

      helper.runInTransaction(agent, async (tx) => {
        const input = { topic: 'scientist' }
        const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

        const chain = prompt.pipe(model).pipe(outputParser)
        await chain.invoke(input, options)

        const events = agent.customEventAggregator.events.toArray()
        test.equal(events.length, 6, 'should create 6 llm events')

        const extractedData = events.map(([firstElm, secondElm]) => {
          const [{ type }, chainEvent] = [firstElm, secondElm]
          return { type, chainEvent }
        })

        const lanChainMessageEvents = extractedData.filter((event) => {
          return (
            event.type === 'LlmChatCompletionMessage' && event.chainEvent.vendor === 'langchain'
          )
        })

        const lanChainSummaryEvents = extractedData.filter((event) => {
          return (
            event.type === 'LlmChatCompletionSummary' && event.chainEvent.vendor === 'langchain'
          )
        })

        test.equal(
          [...lanChainMessageEvents, ...lanChainSummaryEvents].length,
          3,
          'should create 3 langchain events'
        )

        test.match(lanChainSummaryEvents[0].chainEvent, {
          'id': /[a-f0-9]{36}/,
          'appName': 'New Relic for Node.js tests',
          'span_id': tx.trace.root.children[0].id,
          'trace_id': tx.traceId,
          'transaction_id': tx.id,
          // 'request_id': '',
          'ingest_source': 'Node',
          'vendor': 'langchain',
          'metadata.key': 'value',
          'metadata.hello': 'world',
          'tags': 'tag1,tag2',
          // 'conversation_id': '',
          'virtual_llm': true,
          ['response.number_of_messages']: 1
          // 'duration': tx.trace.root.children[0].getDurationInMillis()
          // 'run_id': undefined
        })

        test.match(lanChainMessageEvents[0].chainEvent, {
          id: /[a-f0-9]{36}/,
          appName: 'New Relic for Node.js tests',
          span_id: tx.trace.root.children[0].id,
          trace_id: tx.traceId,
          transaction_id: tx.id,
          ingest_source: 'Node',
          vendor: 'langchain',
          // content: '',
          completion_id: lanChainSummaryEvents[0].chainEvent.id,
          // 'conversation_id': '',
          // sequence: 0,
          virtual_llm: true
          // 'run_id': undefined
        })

        afterEachHook.call(null, t)
        tx.end()
        test.end()
      })
    })
  }
)