/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const amqplib = require('./amqplib')
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

module.exports = [
  {
    moduleName: 'amqplib/callback_api',
    type: InstrumentationDescriptor.TYPE_MESSAGE,
    onRequire: amqplib.instrumentCallbackAPI
  },
  {
    moduleName: 'amqplib',
    type: InstrumentationDescriptor.TYPE_MESSAGE,
    onRequire: amqplib.instrumentPromiseAPI
  }
]
