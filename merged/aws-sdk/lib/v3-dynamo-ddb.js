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
    return
  }

  shim.setDatastore(shim.DYNAMODB)
  shim.wrapClass(dynamoClientExport, 'DynamoDBClient', { post: postClientConstructor, es6: true })

  // eslint-disable-next-line consistent-return
  return
}

/**
 * Calls the instances middlewareStack.use to register
 * a plugin that adds a middleware to record the time it teakes to publish a message
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
  return async function wrappedMiddleware(args) {
    if (!COMMANDS.includes(context.commandName)) {
      return await next(args)
    }

    const [endpoint, region] = await Promise.all([config.endpoint(), config.region()])
    const wrappedNext = shim.recordOperation(
      next,
      getDynamoSpec.bind({
        endpoint,
        region,
        serviceId: config.serviceId
      })
    )

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
  const [command] = args
  const collection = (command.input && command.input.TableName) || 'Unknown'
  const host = this.endpoint && this.endpoint.hostname
  // eslint-disable-next-line camelcase
  const port_path_or_id = this.endpoint && this.endpoint.port
  return {
    name: command.constructor.name,
    parameters: {
      host,
      port_path_or_id,
      collection,
      'product': this.serviceId,
      'aws.operation': command.constructor.name,
      // 'aws.requestId': String,
      'aws.region': this.region,
      'aws.service': this.serviceId
    },
    callback: shim.LAST,
    opaque: true
  }
}
