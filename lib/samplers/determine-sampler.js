/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const AdaptiveSampler = require('./adaptive-sampler')
const AlwaysOffSampler = require('./always-off-sampler')
const AlwaysOnSampler = require('./always-on-sampler')
const TraceIdRatioBasedSampler = require('./ratio-based-sampler')

/**
 * Grabs the global `AdaptiveSampler` instance to share between samplers
 * that are set to `adaptive` with no `sampling_target` specified.
 * @param {object} params Function parameters.
 * @param {Agent} params.agent The New Relic agent instance.
 * @param {object} params.config The entire agent config.
 * @returns {AdaptiveSampler} The global AdaptiveSampler instance.
 */
function getGlobalAdaptiveSampler({ agent, config }) {
  if (!agent.sampler._globalAdaptiveSampler) {
    agent.sampler._globalAdaptiveSampler = new AdaptiveSampler({
      agent,
      serverless: config.serverless_mode.enabled,
      period: config.sampling_target_period_in_seconds * 1000,
      target: config.sampling_target // getter/setter for distributed_tracing.sampler.adaptive_sampling_target
    })
  }
  return agent.sampler._globalAdaptiveSampler
}

/**
 * A helper function for the Agent to determine what sampler
 * to use and will log messages about the chosen sampler.
 * @param {*} params Function parameters.
 * @param {Agent} params.agent The New Relic agent instance.
 * @param {object} params.config The entire agent config.
 * @param {string} params.sampler The sampler type to use: 'root', 'remote_parent_sampled', or 'remote_parent_not_sampled'.
 * @returns {Sampler} A Sampler e.g. AdaptiveSampler or TraceIdRatioBasedSampler
 */
function determineSampler({ agent, config, sampler = 'root' }) {
  const samplerDefinition = config?.distributed_tracing?.sampler?.[sampler]

  // Always on?
  if (samplerDefinition === 'always_on') {
    return new AlwaysOnSampler()
  }

  // Always off?
  if (samplerDefinition === 'always_off') {
    return new AlwaysOffSampler()
  }

  // Is it TraceIdRatioBased?
  if (samplerDefinition?.trace_id_ratio_based) {
    return new TraceIdRatioBasedSampler({
      agent,
      ratio: samplerDefinition.trace_id_ratio_based?.ratio
    })
  }

  // If adaptive.sampling_target set, create a new AdaptiveSampler,
  // else use the global AdaptiveSampler.
  if (samplerDefinition?.sampling_target) {
    return new AdaptiveSampler({
      agent,
      serverless: config.serverless_mode.enabled,
      period: config.sampling_target_period_in_seconds * 1000,
      target: samplerDefinition.sampling_target
    })
  } else return getGlobalAdaptiveSampler({ agent, config })
}

module.exports = determineSampler
