/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const AzureHandler = require('#agentlib/subscribers/azure-functions/azure-handler-base.js')
const Transaction = require('#agentlib/transaction/index.js')
const backgroundRecorder = require('#agentlib/metrics/recorders/other.js')
const { TYPES } = Transaction

module.exports = class BackgroundHandler extends AzureHandler {
  constructor({ subscriber }) {
    super(subscriber)
    this.type = TYPES.BG
  }

  createSegment({ handlerArgs, ctx }) {
    const [, context] = handlerArgs
    const triggerType = context.options?.trigger?.type ?? 'unknown'
    const methodName = triggerType.replace(/Trigger$/, '')
    return this.subscriber.createSegment({
      name: `${methodName}-trigger`,
      recorder: backgroundRecorder,
      ctx
    })
  }
}
