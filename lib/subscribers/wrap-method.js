/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  toggleUnwrappingTracking,
  unwrapAll,
  wrapMethod,
  wrapMethods
}

const { original, unwrap } = require('#agentlib/symbols.js')
const defaultLogger = require('#agentlib/logger.js').child({
  component: 'wrapMethod'
})

let trackForUnwrapping = false
const instrumented = []

/**
 * A callback function used to actually perform the wrapping of a method. It
 * will be provided the original function and the function's name.
 *
 * @typedef {Function} MethodWrapper
 * @param {Function} originalMethod The original method that is being wrapped.
 * @param {string} methodName The name of the method that is being wrapped.
 * @returns {Function} Newly wrapped method.
 */

/**
 * In production environments, i.e. the agent is being used in customer code,
 * we do not track which methods have been wrapped. In a testing environment,
 * though (i.e. our unit/versioned test suites), it is helpful to be able to
 * unwrap methods between tests in the same process. Thus, this function, along
 * with `unwrapAll, is made available for test harnesses to be able to do this
 * clean up work.
 */
function toggleUnwrappingTracking() {
  trackForUnwrapping = trackForUnwrapping !== true
}

/**
 * Used to restore all methods that were wrapped, by either of the wrapping
 * functions in this module, to their original state.
 */
function unwrapAll() {
  while (instrumented.length > 0) {
    (instrumented.pop())[unwrap]()
  }
}

/**
 * Utility for wrapping object method. Provides automatic guardrails for
 * missing or already wrapped method.
 *
 * @example Wrapping a single method.
 * const foo = require('foo')
 * wrapMethod({
 *   module: foo,
 *   methodName: 'bar',
 *   wrapper: function (originalMethod, methodName) {
 *     return function wrappedMethod(...args) {
 *       args[0] = 'we changed stuff'
 *       return originalMethod.apply(foo, args)
 *     }
 *   }
 * })
 *
 * @example Wrapping multiple methods.
 * const foo = require('foo')
 * const toWrap = ['bar', 'baz']
 * for (const method of toWrap) {
 *   wrapMethod({
 *     module: foo,
 *     methodName: method,
 *     wrapper: function (o, m) {
 *       return function wm(...args) {
 *         args[0] = `wrapped ${m}`
 *         return originalMethod.apply(foo, args)
 *       }
 *     }
 *   })
 * }
 *
 * @param {object} params Function parameters.
 * @param {object} params.module The module that holds the reference to the
 * method that needs to be wrapped.
 * @param {string} params.methodName The name of the method to wrap.
 * @param {MethodWrapper} params.wrapper A function that will be the actual
 * wrapper.
 * @param {AgentLogger} [params.logger] A logger instance.
 */
function wrapMethod ({
  module,
  methodName,
  wrapper,
  logger = defaultLogger
} = {}) {
  const originalMethod = module[methodName]

  if (!originalMethod) {
    logger.trace('"%s" method is not defined on the provided module.', methodName)
    return
  }

  if (originalMethod[unwrap]) {
    logger.trace('"%s" is already wrapped. Not wrapping again.', methodName)
    return
  }

  const wrappedMethod = wrapper(originalMethod, methodName)
  for (const [key, value] of Object.entries(originalMethod)) {
    // Sometimes a function is decorated with additional properties.
    // So we must copy those properties over to our wrapped function.
    wrappedMethod[key] = value
  }
  wrappedMethod[original] = originalMethod
  wrappedMethod[unwrap] = function unwrap () {
    module[methodName] = originalMethod
    logger.trace('Removed wrapper from method "%s".', methodName)
  }
  if (trackForUnwrapping === true) {
    instrumented.push(wrappedMethod)
  }

  module[methodName] = wrappedMethod
  logger.trace('Wrapped method "%s".', methodName)
}

/**
 * Convenience function for wrapping multiple methods in one invocation.
 * If a provided method does not exist on the provided module, a log will
 * be issued but no error will be thrown.
 *
 * @see wrapMethod
 *
 * @param {object} params Function parameters.
 * @param {object} params.module Object that holds the references to the
 * methods.
 * @param {string[]} params.methodNames Names of the methods to wrap.
 * @param {MethodWrapper} params.wrapper Function to wrap the individual methods
 * with.
 * @param {AgentLogger} [params.logger] Logger instance.
 */
function wrapMethods({
  module,
  methodNames,
  wrapper,
  logger = defaultLogger
} = {}) {
  for (const methodName of methodNames) {
    if (!module[methodName]) {
      logger.debug(
        'Cannot wrap "%s" because it does not exist on the object.',
        methodName
      )
      continue
    }
    wrapMethod({ module, methodName, wrapper, logger })
  }
}
