/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BunyanSubscriber = require('./base')
const { truncate } = require('../../util/application-logging')

class BunyanEmitSubscriber extends BunyanSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_emit' })
  }

  handler(data, ctx) {
    const [line] = data.arguments
    if (!line) {
      return ctx
    }

    this.incrementLinesMetric(this.NAME_FROM_LEVEL[line.level])
    const decoratedLine = this.decorateLogLine()
    if (decoratedLine) {
      line.message = truncate(line.msg) + decoratedLine
      data.arguments[0] = line
    }
    return ctx
  }
}

module.exports = BunyanEmitSubscriber
