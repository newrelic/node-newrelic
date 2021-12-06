/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { getExport, wrapPostClientConstructor, wrapReturn } = require('./util')
const { dynamoMiddleware } = require('./dynamodb-util')

const CLIENT = 'DynamoDBClient'

const postClientConstructor = wrapPostClientConstructor(getPlugin)
const wrappedReturn = wrapReturn(postClientConstructor)

module.exports = function instrument(shim, name, resolvedName) {
  const dynamoClientExport = getExport(shim, resolvedName, CLIENT)

  if (!shim.isFunction(dynamoClientExport[CLIENT])) {
    shim.logger.debug(`Could not find ${CLIENT}, not instrumenting.`)
  } else {
    shim.setDatastore(shim.DYNAMODB)
    shim.wrapReturn(dynamoClientExport, CLIENT, wrappedReturn)
  }
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
