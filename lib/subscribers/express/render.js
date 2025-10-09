/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Base = require('../base')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')

class ExpressRenderSubscriber extends Base {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'express', channelName: 'nr_render', system: 'Expressjs' })
    this.callback = -1
  }

  handler(data, ctx) {
    const [view] = data.arguments
    const name = `View/${view}/Rendering`
    return this.createSegment({
      recorder: genericRecorder,
      name,
      ctx
    })
  }
}

module.exports = ExpressRenderSubscriber
