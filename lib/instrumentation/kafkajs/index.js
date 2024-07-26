/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const instrumentProducer = require('./producer')
const instrumentConsumer = require('./consumer')
const { kafkaCtx } = require('../../symbols')

module.exports = function initialize(agent, kafkajs, _moduleName, shim) {
  if (agent.config.feature_flag.kafkajs_instrumentation === false) {
    shim.logger.debug(
      '`config.feature_flag.kafkajs_instrumentation is false, skipping instrumentation of kafkajs`'
    )
    return
  }

  shim.setLibrary(shim.KAFKA)

  shim.wrap(kafkajs, 'Kafka', function nrConstructorWrapper(shim, orig) {
    return function nrConstructor() {
      const params = shim.argsToArray.apply(shim, arguments)
      // eslint-disable-next-line new-cap
      const instance = new orig(...params)
      instance[kafkaCtx] = {
        brokers: params[0].brokers
      }

      shim.wrap(instance, 'producer', instrumentProducer)
      shim.wrap(instance, 'consumer', instrumentConsumer)

      return instance
    }
  })
}
