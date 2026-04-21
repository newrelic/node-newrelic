/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware.js')

module.exports = class CreateServerSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_create_server',
      packageName: 'connect',
      system: 'Connect'
    })
    this.events = ['end']
  }

  end(data) {
    const { result: app } = data
    this.#wrapUse(app)
  }

  /**
   * Pops the `use` method from the newly constructed server object
   * and replaces it with one that applies our logic upon invocation.
   * Connect's `use` method inspects the parameters, normalizes them and/or
   * wraps the provided middleware function, adds this information to an
   * array of middleware handlers, and returns the server object so that
   * middleware registrations can be chained.
   *
   * @param {object} app The result of `connect.createServer`.
   */
  #wrapUse(app) {
    const use = app.use
    const subscriber = this
    app.use = function nrUse(route, fn) {
      const r = typeof route === 'string' ? route : '/'
      const mw = typeof route === 'function' ? route : fn
      const wrappedFn = subscriber.wrapper.wrap({ handler: mw, route: r })
      return use.call(app, r, wrappedFn)
    }
  }
}
