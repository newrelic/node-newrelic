/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const instrumentProducer = require('./producer')
const instrumentConsumer = require('./consumer')
const { ClassWrapSpec } = require('../../shim/specs')
const { kafkaCtx } = require('../../symbols')

module.exports = function initialize(agent, kafkajs, _moduleName, shim) {
  if (agent.config.feature_flag.kafkajs_instrumentation === false) {
    shim.logger.debug(
      '`config.feature_flag.kafkajs_instrumentation is false, skipping instrumentation of kafkajs`'
    )
    return
  }

  shim.setLibrary(shim.KAFKA)

  shim.wrapClass(
    kafkajs,
    'Kafka',
    new ClassWrapSpec({
      post: function nrConstructorWrapper(shim, wrappedClass, name, args) {
        this[kafkaCtx] = { brokers: args[0].brokers }
        shim.wrap(this, 'producer', instrumentProducer)
        shim.wrap(this, 'consumer', instrumentConsumer)
      }
    })
  )
}
