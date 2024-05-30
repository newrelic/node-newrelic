/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const instrumentProducer = require('./producer')

// eslint-disable-next-line no-unused-vars
module.exports = function initialize(_agent, kafkajs, _moduleName, shim) {
  shim.setLibrary(shim.KAFKA)

  instrumentProducer({ shim, kafkajs })
}
