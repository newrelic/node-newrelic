/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { geminiApiKey } = require('../../lib/symbols')
const {
    LlmChatCompletionMessage,
    LlmChatCompletionSummary,
    LlmEmbedding,
    LlmErrorMessage
} = require('../../lib/llm-events/google-genai')
const { RecorderSpec } = require('../../lib/shim/specs')
const { extractLlmContext } = require('../util/llm-utils')

const { AI } = require('../../lib/metrics/names')
const { GEMINI } = AI
let TRACKING_METRIC = GEMINI.TRACKING_PREFIX


module.exports = function initialize(agent, googleGenAi, moduleName, shim) {
    if (agent?.config?.ai_monitoring?.enabled !== true) {
        shim.logger.debug('config.ai_monitoring.enabled is set to false. Skipping instrumentation.')
        return
    }

    // Update the tracking metric name with the version of the library
    // being instrumented. We do not have access to the version when
    // initially declaring the variable.
    TRACKING_METRIC = `${TRACKING_METRIC}/${shim.pkgVersion}`
}