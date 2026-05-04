/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const dc = require('node:diagnostics_channel')
const recordSupportabilityMetric = require('./record-supportability-metric.js')
const resolvePackageVersion = require('./resolve-package-version.js')
const semver = require('semver')

/**
 * The baseline parameters available to all subscribers.
 *
 * @typedef {object} SubscriberParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The package name being instrumented.
 * This is what a developer would provide to the `require` function.
 * @property {boolean} [skipUsageMetricRecording=false] When set to `true`, the
 * instrumentation will not attempt to record the usage metric. This is useful
 * when the module being instrumented is also being instrumented via the
 * Orchestrion based subscriber system. It is much cheaper to record the metric
 * via Orchestrion based subscribers than through this direct diagnostics
 * channel method (Orchestrion provides the module version, whereas we have
 * to perform expensive operations here to get the same information).
 * @property {string} versionRange Provide a semver versionRange string
 * to be evaluated before a handler is called.  This is provided to allow
 * us to support specific versions of a given subscriber.
 */

/**
 * @typedef {object} ChannelDescriptor
 * @property {string} channel The fully qualified name of a diagnostic channel,
 * e.g. `undici:request:create`.
 * @property {Function} hook The function to execute when the channel is fired.
 * This function will be bound to the `Subscriber` instance.
 */

/**
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {ChannelDescriptor[]} channels The channels to subscribe to.
 * @property {object} logger An agent logger instance.
 * @property {object} config The agent configuration object.
 * @property {string} id The name of the module being instrumented.
 * This is the same string one would pass to the `require` function.
 * @property {string} versionRange Specifies a semver range to be evaluated
 * before calling a handler.
 */
class Subscriber {
  #usageMetricRecorded = false

  /**
   * @param {SubscriberParams} params to function
   */
  constructor({ agent, logger, packageName, skipUsageMetricRecording = false, versionRange }) {
    this.agent = agent
    this.logger = logger.child({ component: `${packageName}-subscriber` })
    this.config = agent.config
    this.id = packageName
    this.versionRange = versionRange

    if (skipUsageMetricRecording === true) {
      this.#usageMetricRecorded = true
    }
  }

  set channels(channels) {
    if (!Array.isArray(channels)) {
      throw new Error('channels must be a collection of objects with properties channel and hook')
    }

    this._channels = channels
  }

  /**
   * Checks if provided versionRange satisfies the actual package version.
   * If versionRange is not provide it just returns true
   *
   * @returns {boolean} whether or not to call handler
   */
  get shouldCallHandler() {
    if (!this.versionRange) {
      return true
    }

    return semver.satisfies(this.pkgVersion, this.versionRange)
  }

  get channels() {
    return this._channels
  }

  /**
   * Checks if the subscriber is enabled based on the agent's configuration.
   * @returns {boolean} if subscriber is enabled
   */
  get enabled() {
    return this.config.instrumentation[this.id].enabled === true
  }

  enable() {
    return true
  }

  disable() {
    return true
  }

  /**
   * Getter to retrieve version of package
   * **Note**: Can really only be called in the context of the handler
   *
   * It also caches the result to avoid multiple lookups.
   */
  get pkgVersion() {
    if (this._version) {
      return this._version
    }

    this._version = resolvePackageVersion(this.id)
    return this._version
  }

  subscribe() {
    for (let index = 0; index < this.channels.length; index++) {
      const chan = this.channels[index]
      const { hook, channel } = this.channels[index]
      const boundHook = hook.bind(this)
      chan.boundHook = boundHook
      chan.eventHandler = (message, name) => {
        this.#supportability()
        if (this.shouldCallHandler) {
          boundHook(message, name)
        } else {
          this.logger.warn(`Not instrumenting ${channel} as it is not within the supported version range ${this.versionRange}, got ${this.pkgVersion}`)
          this.unsubscribe()
        }
      }
      dc.subscribe(channel, chan.eventHandler)
    }
  }

  unsubscribe() {
    for (let index = 0; index < this.channels.length; index++) {
      const { channel, eventHandler } = this.channels[index]
      dc.unsubscribe(channel, eventHandler)
    }
  }

  /**
   * Since this class subscribes to diagnostics channels natively published by
   * target modules, we do not get the package metadata that Orchestrion
   * provides in its channel events. So we have to try and find the package
   * manifest and get the version out of it in order to record our
   * supportability metric.
   */
  #supportability() {
    if (this.#usageMetricRecorded === true) {
      return
    }
    recordSupportabilityMetric({
      agent: this.agent,
      moduleName: this.id,
      moduleVersion: this.pkgVersion
    })
    this.#usageMetricRecorded = true
  }
}

module.exports = Subscriber
