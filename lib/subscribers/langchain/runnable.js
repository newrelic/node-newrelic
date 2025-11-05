/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LangchainSubscriber = require('./base')
const { AI: { LANGCHAIN } } = require('../../metrics/names')

class LangchainRunnableSubscriber extends LangchainSubscriber {
  constructor ({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_invoke' })
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    if (!this?.agent?.config?.ai_monitoring?.enabled) {
      // We need this check inside the handler because it is possible for monitoring
      // to be disabled at the account level. In such a case, the value is set
      // after the instrumentation has been initialized.
      this.logger.debug('Langchain instrumentation is disabled. To enable, set `config.ai_monitoring.enabled` to true.')
      return ctx
    }

    const segment = this.agent.tracer.createSegment({
      name: `${LANGCHAIN.CHAIN}/invoke`,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }

    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const { result, error: err, moduleVersion: pkgVersion } = data

    this.recordChatCompletionEvents({
      pkgVersion,
      transaction,
      segment,
      messages: [result],
      events: [request, result],
      metadata: params?.metadata ?? {},
      tags: params?.tags ?? [],
      err
    })
  }
}

module.exports = LangchainRunnableSubscriber
