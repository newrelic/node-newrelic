/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')

class VisionRenderSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@hapi/vision', channelName: 'nr_render' })
    this.events = ['end']
  }

  handler(data, ctx) {
    const [filename] = data.arguments
    const name = `View/${filename}/Rendering`
    return this.createSegment({
      recorder: genericRecorder,
      name,
      ctx
    })
  }
}

module.exports = VisionRenderSubscriber
