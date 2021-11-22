/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const COMMANDS = [
  'BatchExecuteStatementCommand',
  'CreateTableCommand',
  'BatchGetItemCommand',
  'BatchWriteItemCommand',
  'DeleteItemCommand',
  'DeleteTableCommand',
  'GetItemCommand',
  'PutItemCommand',
  'QueryCommand',
  'ScanCommand',
  'UpdateItemCommand',
  'UpdateTableCommand'
]

module.exports = function instrument(shim, name, resolvedName) {
  const fileNameIndex = resolvedName.indexOf('/index')
  const relativeFolder = resolvedName.substr(0, fileNameIndex)

  // The path changes depending on the version...
  // so we don't want to hard-code the relative
  // path from the module root.
  const dynamoClientExport = shim.require(`${relativeFolder}/DynamoDBClient`)

  if (!shim.isFunction(dynamoClientExport.DynamoDBClient)) {
    shim.logger.debug('Could not find DynamoDBClient, not instrumenting.')
  } else {
    shim.setDatastore(shim.DYNAMODB)
    shim.wrapReturn(
      dynamoClientExport,
      'DynamoDBClient',
      function wrappedReturn(shim, fn, fnName, instance) {
        postClientConstructor.call(instance, shim)
      }
    )
  }
}

/**
 * Calls the instance's middlewareStack.use to register
 * our instrumentation as a plugin.
 * see: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
 *
 * @param {Shim} shim
 */
function postClientConstructor(shim) {
  this.middlewareStack.use(getPlugin(shim, this.config))
}

/**
 * Returns the plugin object that adds middleware
 *
 * @param {Shim} shim
 * @returns {object}
 */
function getPlugin(shim, config) {
  return {
    applyToStack: (clientStack) => {
      clientStack.add(dynamoMiddleware.bind(null, shim, config), {
        name: 'NewRelicDynamoMiddleware',
        step: 'initialize',
        priority: 'high'
      })
    }
  }
}

/**
 * Middleware hook that records the middleware chain
 * when command is in a list of monitored commands.
 *
 * @param {Shim} shim
 * @param {function} next middleware function
 * @param {Object} context
 * @returns {function}
 */
function dynamoMiddleware(shim, config, next, context) {
  const { commandName } = context
  return async function wrappedMiddleware(args) {
    if (!COMMANDS.includes(commandName)) {
      return await next(args)
    }
    const endpoint = await config.endpoint()
    const getSpec = getDynamoSpec.bind({ endpoint, commandName })
    const wrappedNext = shim.recordOperation(next, getSpec)

    return await wrappedNext(args)
  }
}

/**
 * Returns the spec for Dynamo commands
 *
 * @param {Shim} shim
 * @param {original} original original middleware function
 * @param {Array} args to the middleware function
 * @returns {Object}
 */
function getDynamoSpec(shim, original, name, args) {
  const [{ input }] = args
  const collection = (input && input.TableName) || 'Unknown'
  const host = this.endpoint && this.endpoint.hostname
  const portPathOrId = this.endpoint && this.endpoint.port
  return {
    name: this.commandName,
    parameters: { host, port_path_or_id: portPathOrId, collection },
    callback: shim.LAST,
    opaque: true,
    promise: true
  }
}
