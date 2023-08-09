/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const amqplib = require('./amqplib')

module.exports = [
  {
    moduleName: 'amqplib/callback_api',
    type: 'message',
    onRequire: amqplib.instrumentCallbackAPI
  },
  {
    moduleName: 'amqplib/channel_api',
    type: 'message',
    onRequire: amqplib.instrumentPromiseAPI
  }
]
