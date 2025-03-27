/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const testCases = require('../../lib/otel-bridge-cross-agent-tests/TestCaseDefinitions.json')
const { performOperation, assertAgentOutput, logger } = require('#testlib/otel-bridge-cross-agent-tests/test-utils.js')
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const otel = require('@opentelemetry/api')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({ feature_flag: { opentelemetry_bridge: true } })
  ctx.nr.api = helper.getAgentApi(ctx.nr.agent)
  ctx.nr.tracer = otel.trace.getTracer('cross-agent-tests')
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

testCases.forEach((testCase) => {
  test(testCase.testDescription, async (t) => {
    const { agent, api, tracer } = t.nr
    logger('-----------------------')
    logger('RUNNING TEST', testCase.testDescription)
    testCase.operations.forEach((operation) => {
      performOperation({ agent, api, tracer, operation })
    })

    if (testCase.agentOutput) {
      assertAgentOutput(agent, testCase.agentOutput)
    }
  })
})
