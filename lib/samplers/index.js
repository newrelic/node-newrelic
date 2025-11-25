/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const AdaptiveSampler = require('./adaptive-sampler')
const AlwaysOffSampler = require('./always-off-sampler')
const AlwaysOnSampler = require('./always-on-sampler')
const TraceIdRatioBasedSampler = require('./ratio-based-sampler')

class Samplers {
  constructor(agent) {
    this.adaptiveSampler = null
    this.root = this.determineSampler({ agent, sampler: 'root' })
    this.remoteParentSampled = this.determineSampler({ agent, sampler: 'remote_parent_sampled' })
    this.remoteParentNotSampled = this.determineSampler({ agent, sampler: 'remote_parent_not_sampled' })
  }

  /**
   * Applies the root sampler's sampling decision to the transaction
   * if priority has not already been set. If both full and partial granularity
   * are in use, the full granularity sampler runs first then the partial granularity sampler.
   *
   * @param {Transaction} transaction The transaction to apply the sampling decision to.
   */
  applySamplingDecision(transaction) {
    if (transaction?.priority === null) {
      this.root.applySamplingDecision(transaction)
    }
  }

  /**
   * Applies the appropriate remote parent sampler's sampling decision
   * based on if the traceparent is sampled or not.
   * In the case of adaptive sampler it relies on the tracestate sampling flag
   *
   * @param {object} params to function
   * @param {Transaction} params.transaction The transaction to apply the sampling decision to.
   * @param {TraceParent} params.traceparent The W3C traceparent object.
   * @param {TraceState} params.tracestate The W3C tracestate object.
   */
  applyDTSamplingDecision({ transaction, traceparent, tracestate }) {
    // Decide sampling from w3c data by supplying tracestate to sampler
    if (traceparent?.isSampled === true) {
      this.remoteParentSampled.applySamplingDecision(transaction, tracestate)
    } else if (traceparent?.isSampled === false) {
      this.remoteParentNotSampled.applySamplingDecision(transaction, tracestate)
    }
  }

  /**
   * Even though New Relic headers are deprecated,
   * we still have to apply our sampling decision on top
   * of the priority and sampled values we receive.
   * However, this only applies if the sampler is NOT
   * the default sampler (adaptive). In that case,
   * we leave it alone. ¯\_(ツ)_/¯
   *
   * @param {object} params to function
   * @param {Transaction} params.transaction The transaction to apply the sampling decision to.
   * @param {boolean} params.isSampled The sampled value from the legacy New Relic headers.
   */
  applyLegacyDTSamplingDecision({ transaction, isSampled }) {
    const sampler = isSampled ? this.remoteParentSampled : this.remoteParentNotSampled
    if (sampler.toString() !== 'AdaptiveSampler') {
      sampler.applySamplingDecision(transaction)
    }
  }

  /**
   * Updates the adaptive sampler's target if it exists when server side config sends a new value down
   * @param {number} target The new target value to set
   */
  updateAdaptiveTarget(target) {
    if (this.adaptiveSampler) {
      this.adaptiveSampler.samplingTarget = target
    }
  }

  /**
   * Updates the adaptive sampler's period if it exists when server side config sends a new value down
   * @param {number} period The new period value to set in seconds
   */
  updateAdaptivePeriod(period) {
    if (this.adaptiveSampler) {
      this.adaptiveSampler.samplingPeriod = period * 1000
    }
  }

  /**
   * Returns the global adaptive sampler, creating it if it doesn't exist yet
   * @param {Agent} agent The New Relic agent instance.
   * @returns {AdaptiveSampler} The global AdaptiveSampler instance.
   */
  getAdaptiveSampler(agent) {
    const config = agent.config
    if (!this.adaptiveSampler) {
      this.adaptiveSampler = new AdaptiveSampler({
        agent,
        serverless: config.serverless_mode.enabled,
        period: config.sampling_target_period_in_seconds * 1000,
        target: config.sampling_target
      })
    }
    return this.adaptiveSampler
  }

  /**
   * Determines which sampler to use and will log messages about the chosen sampler.
   * @param {object} params to function
   * @param {Agent} params.agent The New Relic agent instance.
   * @param {string} params.sampler The sampler type to use: 'root', 'remote_parent_sampled', or 'remote_parent_not_sampled'.
   * @returns {Sampler} A Sampler e.g. AdaptiveSampler
   */
  determineSampler({ agent, sampler }) {
    const config = agent.config
    // TODO: handle partial granularity samplers
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
    if (samplerDefinition?.adaptive?.sampling_target) {
      return new AdaptiveSampler({
        agent,
        serverless: config.serverless_mode.enabled,
        period: config.sampling_target_period_in_seconds * 1000,
        target: samplerDefinition.adaptive.sampling_target
      })
    } else {
      return this.getAdaptiveSampler(agent)
    }
  }
}

module.exports = Samplers
