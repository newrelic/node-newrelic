/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helper = require('../../lib/agent_helper')

module.exports = () => {
  const TestPromise = function (executor) {
    this.executorCaller(executor)
  }

  TestPromise.resolve = function (val) {
    const p = Object.create(TestPromise.prototype)
    p.resolver(val)
    return p
  }

  TestPromise.reject = function (val) {
    const p = Object.create(TestPromise.prototype)
    p.rejector(val)
    return p
  }

  TestPromise.promisify = function (shim, func) {
    return function () {
      const args = shim.argsToArray.apply(shim, arguments)
      const p = Object.create(TestPromise.prototype)
      args.push((err, res) => {
        if (err) {
          p.rejector(err)
        } else {
          p.resolver(res)
        }
      })
      func.apply(this, args)
      return p
    }
  }

  TestPromise.prototype.executorCaller = function (executor) {
    try {
      executor(this.resolver.bind(this), this.rejector.bind(this))
    } catch (err) {
      this.rejector(err)
    }
  }

  TestPromise.prototype.resolver = function (resolution) {
    this.resolution = resolution
    helper.runOutOfContext(() => {
      if (this._next._thenned) {
        this._next._thenned(resolution)
      }
    })
  }

  TestPromise.prototype.rejector = function (rejection) {
    this.rejection = rejection
    helper.runOutOfContext(() => {
      if (this._next._caught) {
        this._next._caught(rejection)
      }
    })
  }

  TestPromise.prototype.then = function (res, rej) {
    this.res = res
    this.rej = rej

    this._next = Object.create(TestPromise.prototype)
    this._next._thenned = res
    this._next._caught = rej

    return this._next
  }

  TestPromise.prototype.catch = function (ErrorClass, rej) {
    this.ErrorClass = ErrorClass
    this.rej = rej

    this._next = Object.create(TestPromise.prototype)
    this._next._caught = rej || ErrorClass

    return this._next
  }

  TestPromise.Promise = TestPromise
  return TestPromise
}
