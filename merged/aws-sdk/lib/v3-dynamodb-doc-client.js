/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DDB_COMMAND_TYPES = [
  'PutItemCommand',
  'GetItemCommand',
  'UpdateItemCommand',
  'DeleteItemCommand',
  'BatchGetItemCommand',
  'BatchWriteItemCommand',
  'TransactGetItemsCommand',
  'TransactWriteItemsCommand',
  'QueryCommand',
  'ScanCommand'
]

module.exports = function instrument(shim, name, resolvedName) {
  const fileNameIndex = resolvedName.indexOf('/index')
  const relativeFolder = resolvedName.substr(0, fileNameIndex)

  // The path changes depending on the version... so we don't want to hard-code the relative
  // path from the module root.
  const ddbDocClientExport = shim.require(`${relativeFolder}/DynamoDBDocumentClient`)

  if (!shim.isFunction(ddbDocClientExport.DynamoDBDocumentClient)) {
    shim.logger.debug('Could not find DynamoDBDocumentClient, not instrumenting.')
  }

  shim.setDatastore(shim.DYNAMODB)
  shim.wrapReturn(
    ddbDocClientExport,
    'DynamoDBDocumentClient',
    function wrappedReturn(shim, fn, fnName, instance) {
      postClientConstructor.call(instance, shim)
    }
  )
  shim.wrapReturn(
    ddbDocClientExport.DynamoDBDocumentClient,
    'from',
    function wrappedReturn(shim, fn, fnName, instance) {
      postClientConstructor.call(instance, shim)
    }
  )
}

/**
 * Calls the instances middlewareStack.use to register
 * a plugin that adds a middleware to record the dynamo
 * operations
 * see: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
 *
 * @param {Shim} shim
 */
function postClientConstructor(shim) {
  this.middlewareStack.use(getPlugin(shim, this.config))
}

/**
 * Returns the plugin object that adds an initialize middleware
 *
 * @param {Shim} shim
 * @param {Object} config DynamoDBDocumentClient config
 */
function getPlugin(shim, config) {
  return {
    applyToStack: (clientStack) => {
      clientStack.add(ddbMiddleware.bind(null, shim, config), {
        name: 'NewRelicDynamoDocClientMiddleware',
        step: 'initialize',
        priority: 'high'
      })
    }
  }
}

/**
 * Creates middleware that executes a wrapped middleware
 * to record the dynamo operations when they are applicable
 *
 * @param {Shim} shim
 * @param {Object} config DynamoDBDocumentClient config
 * @param {function} next middleware function
 * @param {Object} context command context
 * @returns {function}
 */
function ddbMiddleware(shim, config, next, context) {
  return async function wrappedMiddleware(args) {
    if (!DDB_COMMAND_TYPES.includes(context.commandName)) {
      return await next(args)
    }

    const endpoint = await config.endpoint()
    const wrappedNext = shim.recordOperation(
      next,
      function wrapNext(shim, original, name, nextArgs) {
        const [{ input: params }] = nextArgs
        return {
          name: context.commandName,
          parameters: {
            host: endpoint && endpoint.hostname,
            port_path_or_id: endpoint && endpoint.port,
            collection: (params && params.TableName) || 'Unknown'
          },
          callback: shim.LAST,
          promise: true,
          opaque: true
        }
      }
    )

    return await wrappedNext(args)
  }
}
