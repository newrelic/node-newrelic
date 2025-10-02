/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const dc = require('node:diagnostics_channel')
const semver = require('semver')
const NAMES = require('#agentlib/metrics/names.js')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const requireChannel = dc.tracingChannel('module.require')
const parse = require('module-details-from-path')
const getPackageVersion = require('#agentlib/util/get-package-version.js')

/**
 * The baseline parameters available to all subscribers.
 *
 * @typedef {object} SubscriberParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The package name being instrumented.
 * This is what a developer would provide to the `require` function.
 * @property {string} channelName A unique name for the diagnostics channel
 * that will be created and monitored.
 */

/**
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {object} config The agent configuration object.
 * @property {string} packageName The name of the module being instrumented.
 * This is the same string one would pass to the `require` function.
 */
class Subscriber {
  constructor({ agent, logger, packageName }) {
    this.agent = agent
    this.logger = logger.child({ component: `${packageName}-subscriber` })
    this.config = agent.config
    this.packageName = packageName
    this.id = packageName
  }

  /**
   * Creates the `Supportability/Features/Instrumentation/OnRequire/<packageName>`
   * and `Supportability/Features/Instrumentation/OnRequire/<packageName>/Version/<majorVersion>`
   * metrics to track the usage of an instrumented package.
   * We only want to increment this once per package, so we check the call count
   *
   * @param {object} [data] - event from `module.require.start` { id, parentFilename }
   * @returns {void}
   */
  trackInstrumentationUsage(data) {
    if (data.id !== this.packageName) {
      return
    }

    const prefix = NAMES.FEATURES.INSTRUMENTATION.ON_REQUIRE
    const instrumentationMetric = `${prefix}/${this.packageName}`
    const metric = this.agent.metrics.getOrCreateMetric(instrumentationMetric)
    if (metric.callCount === 0) {
      metric.incrementCallCount()
    }

    try {
      const resolvedName = require.resolve(data.id, {
        paths: [data.parentFilename]
      })
      const parsed = parse(resolvedName)
      const version = getPackageVersion(parsed.basedir)
      const majorVersion = semver.major(version)
      const versionMetricName = `${instrumentationMetric}/Version/${majorVersion}`
      const versionMetric = this.agent.metrics.getOrCreateMetric(versionMetricName)
      if (versionMetric.callCount === 0) {
        versionMetric.incrementCallCount()
      }
    } catch (error) {
      this.logger.trace('Failed to find version for %s, msg: ', this.packageName, error.message)
    }
  }

  /**
   * Checks if the subscriber is enabled based on the agent's configuration.
   * @returns {boolean} if subscriber is enabled
   */
  get enabled() {
    return this.config.instrumentation[this.packageName].enabled === true
  }

  enable() {
    return true
  }

  disable() {
    return true
  }

  subscribe() {
    this.channels.forEach(({ channel, hook }, index) => {
      const boundHook = hook.bind(this)
      dc.subscribe(channel, boundHook)
      this.channels[index].boundHook = boundHook
    })
    this._subscriptions = {
      start: this.trackInstrumentationUsage.bind(this)
    }
    requireChannel.subscribe(this._subscriptions)
  }

  unsubscribe() {
    this.channels.forEach(({ channel, boundHook }) => {
      dc.unsubscribe(channel, boundHook)
    })
    requireChannel.unsubscribe(this._subscriptions)
  }
}

module.exports = Subscriber
