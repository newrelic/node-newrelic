/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MessageSpec = require('./message')

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} MessageSubscribeSpecParams
 * @mixes MessageSpecParams
 * @property {number|null} [consumer]
 */

/**
 * Spec to describe instrumenting a message broker consumer entity, i.e.
 * the thing that reads and processes messages from a message broker.
 */
class MessageSubscribeSpec extends MessageSpec {
  /**
   * Indicates the position in the instrumented consumer function's arguments
   * list that represents the thing that will handle messages.
   *
   * @type {number|null}
   */
  consumer

  /**
   * Indicates names of functions to be wrapped for message consumption.
   * This must be used in tandem with consumer.
   * @type {Array<string>|null}
   */
  functions

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {MessageSubscribeSpecParams} params
   */
  constructor(params) {
    super(params)

    this.consumer = params.consumer ?? null
    this.functions = params.functions ?? null
  }
}

module.exports = MessageSubscribeSpec
