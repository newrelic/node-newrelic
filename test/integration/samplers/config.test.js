/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable camelcase */
const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const testCases = require('#testlib/cross_agent_tests/samplers/sampler_configuration.json')

for (const testCase of testCases) {
  test(testCase.test_name, (t) => {
    const agent = helper.instrumentMockedAgent({
      distributed_tracing: {
        ...testCase.config
      }
    })
    t.after(() => {
      helper.unloadAgent(agent)
    })
    assertSamplers({ samplers: agent.samplers, assertions: testCase.expected_samplers })
  })
}

/**
 * Lower cases sampler class `toString` value
 * and removes `sampler` to make it easier to assert based on
 * cross agent test assertions
 *
 * @param {Sampler} sampler sampler class to format `toString` value
 * @returns {string} properly formatted name of sampler
 */
function formatSamplerName(sampler) {
  const val = sampler.toString()
  return val.toLowerCase().replace('sampler', '')
}

/**
 * Runs assertions for every sampler based on a given test
 *
 * @param {object} params to function
 * @param {object} params.samplers instantiated samplers from agent instance
 * @param {object} params.assertions assertions to make against constructed samplers
 */
function assertSamplers({ samplers, assertions }) {
  const { full_root, full_remote_parent_not_sampled, full_remote_parent_sampled, partial_root, partial_remote_parent_sampled, partial_remote_parent_not_sampled } = assertions
  assertSampler({ samplers, name: 'root', assertions: full_root })
  assertSampler({ samplers, name: 'remoteParentSampled', assertions: full_remote_parent_sampled })
  assertSampler({ samplers, name: 'remoteParentNotSampled', assertions: full_remote_parent_not_sampled })
  assertSampler({ samplers, name: 'partialRoot', assertions: partial_root })
  assertSampler({ samplers, name: 'partialRemoteParentSampled', assertions: partial_remote_parent_sampled })
  assertSampler({ samplers, name: 'partialRemoteParentNotSampled', assertions: partial_remote_parent_not_sampled })
}

/**
 * Runs assertions for a specific sampler
 *
 * @param {object} params to function
 * @param {object} params.samplers instantiated samplers from agent instance
 * @param {string} params.name key of sampler on `agent.samplers` to run assertions against
 * @param {object} params.assertions assertions to make against constructed samplers
 */
function assertSampler({ samplers, name, assertions }) {
  if (assertions) {
    const sampler = samplers[name]
    const samplerName = formatSamplerName(sampler)
    // replace `_` with `` to make it easier to assert sampler names
    const expectedName = assertions.type.replace(/_/g, '')
    assert.equal(samplerName, expectedName)

    if (assertions.is_global_adaptive_sampler) {
      assert.ok((samplers.adaptiveSampler === sampler) === assertions.is_global_adaptive_sampler)
    }
    if (assertions.target) {
      assert.equal(sampler._samplingTarget, assertions.target)
    }

    if (assertions.ratio) {
      assert.equal(sampler._ratio, assertions.ratio)
    }
  }
}
