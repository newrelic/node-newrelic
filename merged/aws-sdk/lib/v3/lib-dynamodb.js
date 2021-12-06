/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { getExport, wrapPostClientConstructor, wrapReturn } = require('./util')
const { dynamoMiddleware } = require('./dynamodb-util')

const CLIENT = 'DynamoDBDocumentClient'

const postClientConstructor = wrapPostClientConstructor(getPlugin)
const wrappedReturn = wrapReturn(postClientConstructor)

module.exports = function instrument(shim, name, resolvedName) {
  const ddbDocClientExport = getExport(shim, resolvedName, CLIENT)

  if (!shim.isFunction(ddbDocClientExport[CLIENT])) {
    shim.logger.debug(`Could not find ${CLIENT}, not instrumenting.`)
  } else {
    shim.setDatastore(shim.DYNAMODB)
    shim.wrapReturn(ddbDocClientExport, CLIENT, wrappedReturn)
    shim.wrapReturn(ddbDocClientExport[CLIENT], 'from', wrappedReturn)
  }
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
      clientStack.add(dynamoMiddleware.bind(null, shim, config), {
        name: 'NewRelicDynamoDocClientMiddleware',
        step: 'initialize',
        priority: 'high'
      })
    }
  }
}
