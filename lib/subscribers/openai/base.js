/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base')

class OpenAISubscriber extends Subscriber {
  constructor({ agent, logger, channelName }) {
    super({ agent, logger, packageName: 'openai', channelName })
    this.events = ['asyncEnd', 'end']
  }

  get enabled() {
    return super.enabled && this.config.ai_monitoring?.enabled
  }

  /**
   * Temporary fix as `tracePromise` wraps the promise in a native one.
   * We are now wrapping all openai functions in a `traceSync` call.
   * Then we wrap the promise here so it returns the custom promise.
   * OpenAI has a [custom promise](https://github.com/openai/openai-node/blob/master/src/core/api-promise.ts).
   * see: https://github.com/newrelic/node-newrelic/issues/3379
   * see: https://github.com/nodejs/node/issues/59936
   * @param {object} data the data associated with the `end` event
   */
  end(data) {
    const promise = data?.result
    if (!promise.then) {
      return promise
    }

    return promise.then((result) => {
      data.result = result
      this.channel.asyncEnd.publish(data)
      return result
    }).catch((err) => {
      data.error = err
      this.channel.asyncEnd.publish(data)
      return err
    })
  }
}

module.exports = OpenAISubscriber
