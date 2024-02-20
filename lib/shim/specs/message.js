/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const OperationSpec = require('./operation')

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} MessageSpecParams
 * @mixes OperationSpecParams
 * @property {number|string} [destinationName]
 * @property {string|null} [destinationType]
 * @property {Object<string, string>|null} [headers]
 * @property {MessageHandlerFunction|null} [messageHandler]
 * @property {number|string|null} [queue]
 * @property {string|null} [routingKey]
 */

/**
 * Spec that describes how to instrument a message broker.
 */
class MessageSpec extends OperationSpec {
  /**
   * If a number, then it indicates the argument position of the name in the
   * instrumented function's parameters list. Otherwise, it is a string name.
   *
   * @type {number|string|null}
   */
  destinationName

  /**
   * Label indicating what type of message broker is being instrumented.
   *
   * @see {MessageShimTypes}
   * @type {string|null}
   */
  destinationType

  /**
   * Headers to insert into the request being instrumented.
   *
   * @type {Object<string, string>|null}
   */
  headers

  /**
   * A function to handle the result of the instrumented message broker
   * function.
   *
   * @type {MessageHandlerFunction}
   */
  messageHandler

  /**
   * When a number, indicates the argument position of the message queue in the
   * instrumented function's arguments list. Otherwise, it is a string
   * representing the name of the queue.
   *
   * @type {number|string|null}
   */
  queue

  /**
   * The name of the key that provides the routing path for the message
   * broker.
   *
   * @type {string|null}
   */
  routingKey

  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {MessageSpecParams} params
   */
  constructor(params) {
    super(params)

    this.destinationName = params.destinationName ?? null
    this.destinationType = params.destinationType ?? null
    this.headers = params.headers ?? null
    this.messageHandler = params.messageHandler ?? null
    this.queue = params.queue ?? null
    this.routingKey = params.routingKey ?? null
  }
}

module.exports = MessageSpec
