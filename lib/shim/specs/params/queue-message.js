/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* eslint-disable jsdoc/require-property-description */
/**
 * @typedef {object} QueueMessageParametersParams
 * @property {string} [correlation_id]
 * @property {string} [reply_to]
 * @property {string} [routing_key]
 */

/**
 * Represents the parameters that describe a message queue message.
 */
class QueueMessageParameters {
  /* eslint-disable jsdoc/require-param-description */
  /**
   * @param {QueueMessageParametersParams} params
   */
  constructor(params) {
    this.correlation_id = params.correlation_id ?? null
    this.reply_to = params.reply_to ?? null
    this.routing_key = params.routing_key ?? null
    this.host = params.host ?? null
    this.port = params.port ?? null
  }
}

module.exports = QueueMessageParameters
