/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Defines constants and utility methods for interacting with message broker
 * systems, e.g. AWS SNS/SQS, Kafka, or other types of message queues.
 */
class MessageBrokerDescription {
  static BROKER_MODE_CONSUME = 'Consume'
  static BROKER_MODE_PRODUCE = 'Produce'

  // DESTINATION_* constants classify the types of message brokers we
  // instrument. These values are used in segment naming.
  static DESTINATION_TYPE_EXCHANGE = 'Exchange'
  static DESTINATION_TYPE_QUEUE = 'Queue'
  static DESTINATION_TYPE_TOPIC = 'Topic'

  // LIB_* constants define the names of libraries we recognize. These names
  // are used in segment naming.
  static LIB_IRONMQ = 'IronMQ'
  static LIB_KAFKA = 'Kafka'
  static LIB_RABBITMQ = 'RabbitMQ'
  static LIB_SNS = 'SNS'
  static LIB_SQS = 'SQS'

  // TRANSPORT_* constants define the names of transport systems we recognize.
  // These names are used in segment naming.
  static TRANSPORT_TYPE_AMQP = 'AMQP'
  static TRANSPORT_TYPE_IRONMQ = 'IronMQ'
  static TRANSPORT_TYPE_KAFKA = 'Kafka'
  static TRANSPORT_TYPE_RABBITMQ = MessageBrokerDescription.TRANSPORT_TYPE_AMQP
  /**
   * The `Queue` type is used for generic queue transports, e.g. SQS.
   * @type {string}
   */
  static TRANSPORT_TYPE_QUEUE = MessageBrokerDescription.DESTINATION_TYPE_QUEUE

  /**
   * The name of the message broker library being instrumented. It should
   * be set to one of the `LIB_*` constants.
   *
   * @type {string}
   */
  #library = undefined

  /**
   * The broker communication mode. It should be set to one of the
   * `BROKER_MODE_*` constants.
   *
   * @type {string}
   */
  #mode = undefined

  /**
   * Name of the target queue, or "thing" accepting delivery of messages.
   *
   * @type {string}
   */
  #destinationName = undefined

  /**
   * Defines the name of the target message broker transport.
   *
   * @type {string}
   */
  #destinationType = undefined

  /**
   * @param {object} params Constructor parameters.
   * @param {string} params.libraryName Name of the system being targeted,
   * e.g. `SNS` or `Kafka`. In almost all cases, it should be one of the
   * `LIB_*` constants.
   * @param {string} [params.destinationName] Name of the queue, or whatever,
   * that the message(s) will be delivered to. When not set, will default to
   * `Temp`.
   * @param {string} [params.destinationType] Classification name for the target
   * queue, e.g. `Queue` or `Topic`. Should be one of the `DESTINATION_TYPE_*`
   * constants.
   * @param {string} [params.mode] Indicates the communication mode for the
   * current action. Should be one of `BROKER_MODE_CONSUME` or
   * `BROKER_MODE_PRODUCE`.
   */
  constructor({
    libraryName,
    destinationName = undefined,
    destinationType = MessageBrokerDescription.DESTINATION_TYPE_EXCHANGE,
    mode = MessageBrokerDescription.BROKER_MODE_PRODUCE
  }) {
    this.#mode = mode
    this.#library = libraryName
    this.#destinationName = destinationName
    this.#destinationType = destinationType

    const upperLibraryName = libraryName.toUpperCase()
    switch (upperLibraryName) {
      case 'AMQP':
      case 'IRONMQ':
      case 'KAFKA':
      case 'RABBITMQ': {
        this.#destinationType = MessageBrokerDescription[`TRANSPORT_TYPE_${upperLibraryName}`]
        break
      }
    }
  }

  get segmentName() {
    return [
      'MessageBroker',
      this.#library,
      this.#destinationType,
      this.#mode,
      typeof this.#destinationName === 'string'
        ? `Named/${this.#destinationName}`
        : 'Temp'
    ].join('/')
  }
}

module.exports = MessageBrokerDescription
