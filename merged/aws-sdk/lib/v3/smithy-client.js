/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const UNKNOWN = 'Unknown'

module.exports = function instrumentSmithyClient(shim, name, resolvedName) {
  const fileNameIndex = resolvedName.indexOf('/index')
  const relativeFolder = resolvedName.substr(0, fileNameIndex)

  // The path changes depending on the version... so we don't want to hard-code the relative
  // path from the module root.
  const smithyClientExport = shim.require(`${relativeFolder}/client`)

  if (!shim.isFunction(smithyClientExport.Client)) {
    shim.logger.debug('Could not find Smithy Client, not instrumenting.')
    return
  }

  shim.wrapClass(smithyClientExport, 'Client', { post: postClientConstructor, es6: true })
}

/**
 * Calls the instances middlewareStack.use to register
 * a plugin that adds 2 different middleware at various
 * stages of a middleware stack
 * see: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
 *
 * @param {Shim} shim
 */
function postClientConstructor(shim) {
  this.middlewareStack.use(getPlugin(shim, this.config))
}

/**
 * Returns the plugin object that adds 2 middleware
 *
 * @param {Shim} shim
 * @param {Object} config smithy client config
 */
function getPlugin(shim, config) {
  return {
    applyToStack: (clientStack) => {
      clientStack.add(headerMiddleware.bind(null, shim), {
        name: 'NewRelicHeader',
        step: 'build'
      })
      clientStack.add(attrMiddleware.bind(null, shim, config), {
        name: 'NewRelicDeserialize',
        step: 'deserialize'
      })
    }
  }
}

/**
 * Wraps the build middleware step to add the disable DT
 * header to all outgoing requests
 *
 * @param {Shim} shim
 * @param {function} next next function in middleware chain
 * @return {function}
 *
 */
function headerMiddleware(shim, next) {
  return async function wrappedHeaderMw(args) {
    args.request.headers[shim.DISABLE_DT] = true
    return await next(args)
  }
}

/**
 * Wraps the deserialize middleware step to add the
 * appropriate segment attributes for the AWS command
 *
 * @param {Shim} shim
 * @param {Object} config AWS command configuration
 * @param {function} next next function in middleware chain
 * @param {Object} contxt AWS command context
 * @return {function}
 */
function attrMiddleware(shim, config, next, context) {
  return async function wrappedMiddleware(args) {
    let region
    try {
      region = await config.region()
    } catch (err) {
      shim.logger.debug(err, 'Failed to get the AWS region')
    } finally {
      const result = await next(args)
      addAwsAttributes({ result, config, region, shim, context })
      return result
    }
  }
}

/**
 * Adds the necessary aws.* attributes to either the External or first
 * class operation segment
 *
 * @param {Object} params
 * @param {Object} params.result result from middleware
 * @param {Object} params.config AWS config
 * @param {string} params.region AWS region
 * @param {Shim} params.shim
 * @param {Object} params.context smithy client context
 */
function addAwsAttributes({ result, config, region, shim, context }) {
  try {
    const { response } = result
    const segment = shim.getSegment(response.body.req)
    segment.addAttribute('aws.operation', context.commandName || UNKNOWN)
    segment.addAttribute('aws.requestId', response.headers['x-amzn-requestid'] || UNKNOWN)
    segment.addAttribute('aws.service', config.serviceId || UNKNOWN)
    segment.addAttribute('aws.region', region || UNKNOWN)
  } catch (err) {
    shim.logger.debug(err, 'Failed to add AWS attributes to segment')
  }
}
