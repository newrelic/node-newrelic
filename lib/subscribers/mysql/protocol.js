/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('#agentlib/subscribers/base.js')
const channels = require('./channels.js')

class MysqlProtocolSubscriber extends Subscriber {
  constructor({ ...rest }) {
    // Note: we set `system` to `MySQL` instead of `mysql` because the system
    // string is used when constructing metric name strings and our tests,
    // as well as potentially customers's alerts, are keyed on the explicit
    // "proper" casing.
    super({ packageName: 'mysql', channelName: channels.PROTOCOL, system: 'MySQL', ...rest })
    this.events = ['start']
    this.propagateTx = true
  }

  handler(...args) {
    return super.handler(...args)
  }

  start(data) {
    const { segment, transaction } = this.agent.tracer.getContext()
    if (segment == null || transaction == null) {
      return
    }

    const { arguments: args } = data
    const emitter = args[0]
    // TODO: check for emitter._callback === null

    // TODO: maybe need to wrap the `.on` function so that we can append at the end
    emitter.on('end', function () {
      process._rawDebug('!!! emitter end hit')
      // segment.touch()
    })
  }

  // end(data) {
  //   // process._debug('protocol end')
  //   const ctx = this.agent.tracer.getContext()
  //   if (ctx?.segment == null || ctx?.transaction == null) {
  //     return
  //   }
  //
  //   const { segment, transaction } = ctx
  //   const { error, result: emitter } = data
  //
  //   if (error) {
  //     segment.touch()
  //     return
  //   }
  //
  //   emitter.on('end', () => {
  //     segment.touch()
  //   })
  // }
}

module.exports = MysqlProtocolSubscriber
