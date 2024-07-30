/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { MessageSpec } = require('../../shim/specs')
const { parseConnect, getParameters, TEMP_RE } = require('./utils')

/**
 *
 * Instruments the sendOrEnqueue and sendMessage methods of the ampqlib channel.
 *
 * @param {Shim} shim instance of shim
 */
module.exports = function wrapChannel(shim) {
  const libChannel = shim.require('./lib/channel')
  if (!libChannel?.Channel?.prototype) {
    shim.logger.debug('Could not get Channel class to instrument.')
    return
  }

  const proto = libChannel.Channel.prototype
  if (shim.isWrapped(proto.sendMessage)) {
    shim.logger.trace('Channel already instrumented.')
    return
  }
  shim.logger.trace('Instrumenting basic Channel class.')

  shim.wrap(proto, 'sendOrEnqueue', function wrapSendOrEnqueue(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }

    return function wrappedSendOrEnqueue() {
      const segment = shim.getSegment()
      const cb = arguments[arguments.length - 1]
      if (!shim.isFunction(cb) || !segment) {
        shim.logger.debug({ cb: !!cb, segment: !!segment }, 'Not binding sendOrEnqueue callback')
        return fn.apply(this, arguments)
      }

      shim.logger.trace('Binding sendOrEnqueue callback to %s', segment.name)
      const args = shim.argsToArray.apply(shim, arguments)
      args[args.length - 1] = shim.bindSegment(cb, segment)
      return fn.apply(this, args)
    }
  })

  shim.recordProduce(proto, 'sendMessage', function recordSendMessage(shim, fn, n, args) {
    const fields = args[0]
    if (!fields) {
      return null
    }
    const isDefault = fields.exchange === ''
    let exchange = 'Default'
    if (!isDefault) {
      exchange = TEMP_RE.test(fields.exchange) ? null : fields.exchange
    }
    const { host, port } = parseConnect(this?.connection?.stream)

    return new MessageSpec({
      destinationName: exchange,
      destinationType: shim.EXCHANGE,
      routingKey: fields.routingKey,
      headers: fields.headers,
      parameters: getParameters({ parameters: Object.create(null), fields, host, port })
    })
  })
}
