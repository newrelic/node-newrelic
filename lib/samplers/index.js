/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const AdaptiveSampler = require('./adaptive-sampler')
const AlwaysOffSampler = require('./always-off-sampler')
const AlwaysOnSampler = require('./always-on-sampler')
const TraceIdRatioBasedSampler = require('./ratio-based-sampler')
const logger = require('../logger').child({ component: 'samplers' })

class Samplers {
  constructor(agent) {
    this.fullEnabled = agent.config.distributed_tracing.sampler.full_granularity.enabled
    this.partialEnabled = agent.config.distributed_tracing.sampler.partial_granularity.enabled
    this.adaptiveSampler = null
    this.root = this.determineSampler({ agent, sampler: 'root' })
    this.remoteParentSampled = this.determineSampler({ agent, sampler: 'remote_parent_sampled' })
    this.remoteParentNotSampled = this.determineSampler({ agent, sampler: 'remote_parent_not_sampled' })
    this.partialRoot = this.determineSampler({ agent, sampler: 'root', isPartial: true })
    this.partialRemoteParentSampled = this.determineSampler({ agent, sampler: 'remote_parent_sampled', isPartial: true })
    this.partialRemoteParentNotSampled = this.determineSampler({ agent, sampler: 'remote_parent_not_sampled', isPartial: true })
  }

  /**
   * Fallback sampling decision. This should only be called if both full and partial granularity are disabled
   * @param {object} params to function
   * @param {Transaction} params.transaction The transaction to apply the sampling decision to.
   */
  applyDefaultDecision({ transaction }) {
    if (!transaction) {
      logger.trace('Both full and partial granularity samplers are disabled. No transaction provided to apply default sampling decision.')
      return
    }

    logger.trace('Both full and partial granularity samplers are disabled. Applying default sampling decision of not sampled and priority 0 for transaction %s', transaction?.id)
    transaction.sampled = false
    transaction.priority = 0
  }

  /**
   * Applies the root sampler's sampling decision to the transaction
   * if priority has not already been set. If both full and partial granularity
   * are in use, the full granularity sampler runs first then the partial granularity sampler.
   *
   * @param {Transaction} transaction The transaction to apply the sampling decision to.
   */
  applySamplingDecision({ transaction }) {
    if (transaction?.priority === null) {
      if (this.fullEnabled === false && this.partialEnabled === false) {
        this.applyDefaultDecision({ transaction })
        return
      }

      if (this.fullEnabled) {
        this.root.applySamplingDecision({ transaction, isFullTrace: true })
        logger.trace('Ran full granularity %s sampler for transaction %s, decision: { sampled: %s, priority: %n}', this.root.toString(), transaction?.id, transaction?.sampled, transaction?.priority)
      }
      if (!transaction?.sampled && this.partialEnabled) {
        this.partialRoot.applySamplingDecision({ transaction })
        logger.trace('Ran partial granularity %s sampler for transaction %s, decision: { sampled: %s, priority: %n}', this.partialRoot.toString(), transaction?.id, transaction?.sampled, transaction?.priority)
      }
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
    if (this.fullEnabled === false && this.partialEnabled === false) {
      this.applyDefaultDecision({ transaction })
      return
    }

    // Decide sampling from w3c data by supplying tracestate to sampler
    if (traceparent?.isSampled === true) {
      if (this.fullEnabled) {
        this.remoteParentSampled.applySamplingDecision({ transaction, tracestate, isFullTrace: true })
        logger.trace('Ran DT Sampling full granularity %s sampler for transaction %s, decision: { sampled: %s, priority: %n}', this.remoteParentSampled.toString(), transaction?.id, transaction?.sampled, transaction?.priority)
      }
      if (!transaction?.sampled && this.partialEnabled) {
        this.partialRemoteParentSampled.applySamplingDecision({ transaction, tracestate })
        logger.trace('Ran DT Sampling partial granularity %s sampler for transaction %s, decision: { sampled: %s, priority: %n}', this.partialRemoteParentSampled.toString(), transaction?.id, transaction?.sampled, transaction?.priority)
      }
    } else if (traceparent?.isSampled === false) {
      if (this.fullEnabled) {
        this.remoteParentNotSampled.applySamplingDecision({ transaction, tracestate, isFullTrace: true })
        logger.trace('Ran DT Sampling full granularity %s sampler for transaction %s, decision: { sampled: %s, priority: %n}', this.remoteParentNotSampled.toString(), transaction?.id, transaction?.sampled, transaction?.priority)
      }
      if (!transaction?.sampled && this.partialEnabled) {
        this.partialRemoteParentNotSampled.applySamplingDecision({ transaction, tracestate })
        logger.trace('Ran DT Sampling partial granularity %s sampler for transaction %s, decision: { sampled: %s, priority: %n}', this.partialRemoteParentNotSampled.toString(), transaction?.id, transaction?.sampled, transaction?.priority)
      }
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
    if (this.fullEnabled === false && this.partialEnabled === false) {
      this.applyDefaultDecision({ transaction })
      return
    }

    const sampler = isSampled ? this.remoteParentSampled : this.remoteParentNotSampled
    const partialSampler = isSampled ? this.partialRemoteParentSampled : this.partialRemoteParentNotSampled
    if (this.fullEnabled) {
      if (sampler?.toString() === 'AdaptiveSampler') {
        logger.trace('Not applying full granularity sampling decision from legacy DT headers for transaction %s because sampler is AdaptiveSampler', transaction?.id)
      } else {
        sampler.applySamplingDecision({ transaction, isFullTrace: true })
        logger.trace('Ran Legacy DT Sampling full granularity %s sampler for transaction %s, decision: { sampled: %s, priority: %n}', sampler.toString(), transaction?.id, transaction?.sampled, transaction?.priority)
      }
    }

    if (!transaction.sampled && this.partialEnabled) {
      if (partialSampler?.toString() === 'AdaptiveSampler') {
        logger.trace('Not applying partial granularity sampling decision from legacy DT headers for transaction %s because sampler is AdaptiveSampler', transaction?.id)
      } else {
        partialSampler.applySamplingDecision({ transaction })
        logger.trace('Ran Legacy DT Sampling partial granularity %s sampler for transaction %s, decision: { sampled: %s, priority: %n}', partialSampler.toString(), transaction?.id, transaction?.sampled, transaction?.priority)
      }
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
   * @param {boolean} params.isPartial Whether to determine the partial granularity sampler.
   * @returns {Sampler} A Sampler e.g. AdaptiveSampler
   */
  determineSampler({ agent, sampler, isPartial }) {
    const config = agent.config
    let samplerDefinition = null
    if (isPartial) {
      samplerDefinition = config?.distributed_tracing?.sampler?.partial_granularity?.[sampler]
    } else {
      samplerDefinition = config?.distributed_tracing?.sampler?.[sampler]
    }

    if (!samplerDefinition) {
      return samplerDefinition
    }

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
      let ratio = samplerDefinition.trace_id_ratio_based?.ratio
      // If both partial and full granularity for a particular section are both set to trace ratio, agent **MUST** set the partial granularity ratio = full granularity ratio + partial granularity ratio
      if (isPartial && this.fullEnabled && config?.distributed_tracing?.sampler?.[sampler]?.trace_id_ratio_based?.ratio) {
        ratio += config.distributed_tracing.sampler[sampler].trace_id_ratio_based.ratio
      }
      return new TraceIdRatioBasedSampler({
        agent,
        ratio
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
