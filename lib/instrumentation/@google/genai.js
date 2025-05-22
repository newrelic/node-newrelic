/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { geminiApiKey } = require('../../../lib/symbols')
const {
    LlmChatCompletionMessage,
    LlmChatCompletionSummary,
    LlmEmbedding,
    LlmErrorMessage
} = require('../../../lib/llm-events/google-genai')
const { RecorderSpec } = require('../../../lib/shim/specs')
const { extractLlmContext } = require('../../util/llm-utils')

const { AI } = require('../../../lib/metrics/names')
const { GEMINI } = AI
let TRACKING_METRIC = GEMINI.TRACKING_PREFIX

/**
 * Enqueues a LLM event to the custom event aggregator
 *
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {string} params.type LLM event type
 * @param {object} params.msg LLM event
 */
function recordEvent({ agent, type, msg }) {
    const llmContext = extractLlmContext(agent)

    agent.customEventAggregator.add([
        { type, timestamp: Date.now() },
        Object.assign({}, msg, llmContext)
    ])
}

/**
 * Increments the tracking metric and sets the llm attribute on transactions
 *
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {Transaction} params.transaction active transaction
 */
function addLlmMeta({ agent, transaction }) {
    agent.metrics.getOrCreateMetric(TRACKING_METRIC).incrementCallCount()
    transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
}

/**
 * Generates LlmChatCompletionSummary for a chat completion creation.
 * Also iterates over both input messages and the first response message
 * and creates LlmChatCompletionMessage.
 *
 * Also assigns relevant ids by response id for LlmFeedbackEvent creation
 *
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {Shim} params.shim the current shim instance
 * @param {TraceSegment} params.segment active segment from chat completion
 * @param {object} params.request chat completion params
 * @param {object} params.response chat completion response
 * @param {boolean} [params.err] err if it exists
 * @param {Transaction} params.transaction active transaction
 */
function recordChatCompletionMessages({
    agent,
    shim,
    segment,
    request,
    response,
    err,
    transaction
}) {
    if (!response) {
        // If we get an error, it is possible that `response = null`.
        // In that case, we define it to be an empty object.
        response = {}
    }

    // response.headers = segment[] 
    // explicitly end segment to consistent duration
    // for both LLM events and the segment
    segment.end()
    const completionSummary = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction,
        request,
        response,
        withError: err != null
    })

    // Only take the first response message and append to input messages
    const messages = [...request.messages, response?.choices?.[0]?.message]
    messages.forEach((message, index) => {
        const completionMsg = new LlmChatCompletionMessage({
            agent,
            segment,
            transaction,
            request,
            response,
            index,
            completionId: completionSummary.id,
            message
        })

        recordEvent({ agent, type: 'LlmChatCompletionMessage', msg: completionMsg })
    })

    recordEvent({ agent, type: 'LlmChatCompletionSummary', msg: completionSummary })

    if (err) {
        const llmError = new LlmErrorMessage({ cause: err, summary: completionSummary, response })
        agent.errors.add(transaction, err, llmError)
    }

    delete response.headers
}

module.exports = function initialize(agent, googleGenAi, moduleName, shim) {
    if (agent?.config?.ai_monitoring?.enabled !== true) {
        shim.logger.debug('config.ai_monitoring.enabled is set to false. Skipping instrumentation.')
        return
    }

    // Update the tracking metric name with the version of the library
    // being instrumented. We do not have access to the version when
    // initially declaring the variable.
    TRACKING_METRIC = `${TRACKING_METRIC}/${shim.pkgVersion}`

    const models = googleGenAi.Models
    /**
     * Instruments chat completion creation
     * and creates the LLM events
     *
     * **Note**: Currently only for promises. streams will come later
     */
    shim.record(
        models.prototype,
        'generateContentInternal',
        function wrapGenerateContent(shim, func, name, args) {
            const [request] = args
            const model = request?.model
            const contents = request?.contents // the prompt

            return new RecorderSpec({
                name: GEMINI.COMPLETION,
                promise: true,
                after({ error: err, result: response, segment, transaction }) {
                    recordChatCompletionMessages({
                        agent,
                        shim,
                        segment,
                        transaction,
                        request,
                        response,
                        err
                    })

                    addLlmMeta({ agent, transaction })
                }
            })
        }
    )
}