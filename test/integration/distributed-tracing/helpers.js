/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { hasOwn } = require('../../../lib/util/properties')
function buildFullTracingConfig(initConfig, testCase) {
  initConfig.distributed_tracing.sampler.remote_parent_sampled = testCase.remote_parent_sampled ?? 'adaptive'
  initConfig.distributed_tracing.sampler.remote_parent_not_sampled = testCase.remote_parent_not_sampled ?? 'adaptive'
  initConfig.distributed_tracing.sampler.root = testCase.root ?? 'adaptive'

  if (hasOwn(testCase, 'full_granularity_ratio')) {
    // The ratio to use for all of the trace ID ratio samplers defined in the test.
    // For testing purposes we are not defining different ratios for each trace ID ratio sampler instance.
    if (initConfig.distributed_tracing.sampler.root === 'trace_id_ratio_based') {
      initConfig.distributed_tracing.sampler.root = {
        trace_id_ratio_based: {
          ratio: testCase.full_granularity_ratio
        }
      }
    }
    if (initConfig.distributed_tracing.sampler.remote_parent_sampled === 'trace_id_ratio_based') {
      initConfig.distributed_tracing.sampler.remote_parent_sampled = {
        trace_id_ratio_based: {
          ratio: testCase.full_granularity_ratio
        }
      }
    }
    if (initConfig.distributed_tracing.sampler.remote_parent_not_sampled === 'trace_id_ratio_based') {
      initConfig.distributed_tracing.sampler.remote_parent_not_sampled = {
        trace_id_ratio_based: {
          ratio: testCase.full_granularity_ratio
        }
      }
    }
  }

  if (hasOwn(testCase, 'full_granularity_enabled')) {
    initConfig.distributed_tracing.sampler.full_granularity.enabled = testCase.full_granularity_enabled
  }
}

function buildPartialTracingConfig(initConfig, testCase) {
  if (hasOwn(testCase, 'partial_granularity_enabled')) {
    initConfig.distributed_tracing.sampler.partial_granularity.enabled = testCase.partial_granularity_enabled
  }

  initConfig.distributed_tracing.sampler.partial_granularity.remote_parent_sampled = testCase.partial_granularity_remote_parent_sampled ?? 'adaptive'
  initConfig.distributed_tracing.sampler.partial_granularity.remote_parent_not_sampled = testCase.partial_granularity_remote_parent_not_sampled ?? 'adaptive'
  initConfig.distributed_tracing.sampler.partial_granularity.root = testCase.partial_granularity_root ?? 'adaptive'

  if (hasOwn(testCase, 'partial_granularity_ratio')) {
    // The ratio to use for all of the trace ID ratio samplers defined in the test.
    // For testing purposes we are not defining different ratios for each trace ID ratio sampler instance.
    if (initConfig.distributed_tracing.sampler.partial_granularity.root === 'trace_id_ratio_based') {
      initConfig.distributed_tracing.sampler.partial_granularity.root = {
        trace_id_ratio_based: {
          ratio: testCase.partial_granularity_ratio
        }
      }
    }
    if (initConfig.distributed_tracing.sampler.partial_granularity.remote_parent_sampled === 'trace_id_ratio_based') {
      initConfig.distributed_tracing.sampler.partial_granularity.remote_parent_sampled = {
        trace_id_ratio_based: {
          ratio: testCase.partial_granularity_ratio
        }
      }
    }
    if (initConfig.distributed_tracing.sampler.partial_granularity.remote_parent_not_sampled === 'trace_id_ratio_based') {
      initConfig.distributed_tracing.sampler.partial_granularity.remote_parent_not_sampled = {
        trace_id_ratio_based: {
          ratio: testCase.partial_granularity_ratio
        }
      }
    }
  }
}

function buildSamplerConfig(testCase) {
  // Sampling config has to be given on agent initialization
  const initConfig = {
    distributed_tracing: {
      enabled: true,
      sampler: {
        full_granularity: {
          enabled: true
        },
        partial_granularity: {
          enabled: false
        }
      }
    }
  }
  if (hasOwn(testCase, 'distributed_tracing_enabled')) {
    initConfig.distributed_tracing.enabled = testCase.distributed_tracing_enabled
  }
  buildFullTracingConfig(initConfig, testCase)
  buildPartialTracingConfig(initConfig, testCase)

  return initConfig
}

function getEventsToCheck(eventType, agent) {
  let toCheck
  switch (eventType) {
    case 'Transaction':
      toCheck = agent.transactionEventAggregator.getEvents()
      break
    case 'TransactionError':
      toCheck = agent.errors.eventAggregator.getEvents()
      break
    case 'Span':
      toCheck = agent.spanEventAggregator.getEvents()
      break
    default:
      throw new Error('I do no know how to test an ' + eventType)
  }
  return toCheck
}

function getExactExpectedUnexpectedFromIntrinsics(testCase, eventType) {
  const common = testCase.intrinsics.common
  const specific = testCase.intrinsics[eventType] || {}
  const exact = Object.assign(specific.exact || {}, common.exact || {})
  const expected = (specific.expected || []).concat(common.expected || [])
  const unexpected = (specific.unexpected || []).concat(common.unexpected || [])

  return {
    exact,
    expected,
    unexpected
  }
}

function forceAdaptiveSamplers(agent, forceAdaptiveSampled) {
  if (forceAdaptiveSampled === undefined || forceAdaptiveSampled === null) return
  // "The sampling decision to force on a transaction whenever the adaptive sampler is used"
  // implies this affects all samplers that are adaptive samplers
  const samplers = [
    agent.samplers.root,
    agent.samplers.remoteParentSampled,
    agent.samplers.remoteParentNotSampled
  ]
  for (const sampler of samplers) {
    if (sampler?.toString() === 'AdaptiveSampler') {
      sampler.shouldSample = function stubShouldSample() {
        return forceAdaptiveSampled
      }
    }
  }
}

module.exports = {
  buildSamplerConfig,
  forceAdaptiveSamplers,
  getEventsToCheck,
  getExactExpectedUnexpectedFromIntrinsics
}
