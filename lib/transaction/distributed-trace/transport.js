/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Distributed traces may be delivered over a limited set of transports.
 * `Transport` codifies this list and provides mechanisms for enumerating and
 * validating transport types. It is the source of truth for these values;
 * other modules (e.g. `MessageBrokerDescription`) derive their transport
 * constants from it.
 */
class Transport {
  static AMQP = 'AMQP'
  static HTTP = 'HTTP'
  static HTTPS = 'HTTPS'
  static IRONMQ = 'IronMQ'
  static JMS = 'JMS'
  static KAFKA = 'Kafka'
  static OTHER = 'Other'
  static QUEUE = 'Queue'
  static UNKNOWN = 'Unknown'

  /**
   * @returns {string[]} The valid transport type values, e.g.
   * `['AMQP', 'HTTP', 'HTTPS', 'IronMQ', 'JMS', 'Kafka', 'Other', 'Queue', 'Unknown']`.
   */
  static values() {
    return [
      Transport.AMQP,
      Transport.HTTP,
      Transport.HTTPS,
      Transport.IRONMQ,
      Transport.JMS,
      Transport.KAFKA,
      Transport.OTHER,
      Transport.QUEUE,
      Transport.UNKNOWN
    ]
  }

  /**
   * Enumerates the transports as `[name, value]` pairs, mirroring
   * `Object.entries` over a plain enum object.
   *
   * @returns {string[][]} The `[name, value]` pairs.
   */
  static entries() {
    return [
      ['AMQP', Transport.AMQP],
      ['HTTP', Transport.HTTP],
      ['HTTPS', Transport.HTTPS],
      ['IRONMQ', Transport.IRONMQ],
      ['JMS', Transport.JMS],
      ['KAFKA', Transport.KAFKA],
      ['OTHER', Transport.OTHER],
      ['QUEUE', Transport.QUEUE],
      ['UNKNOWN', Transport.UNKNOWN]
    ]
  }

  /**
   * @param {string} value A candidate transport type value.
   * @returns {boolean} True when `value` is a valid transport type.
   */
  static isValid(value) {
    return Transport.values().includes(value)
  }
}

module.exports = Transport
