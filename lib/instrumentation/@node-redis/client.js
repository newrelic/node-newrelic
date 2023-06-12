/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const CLIENT_COMMANDS = ['select', 'quit', 'SELECT', 'QUIT']
const opts = Symbol('clientOptions')

module.exports = function initialize(_agent, redis, _moduleName, shim) {
  shim.setDatastore(shim.REDIS)
  const COMMANDS = Object.keys(shim.require('dist/lib/client/commands.js').default)
  const CMDS_TO_INSTRUMENT = [...COMMANDS, ...CLIENT_COMMANDS]
  shim.wrap(redis, 'createClient', function wrapCreateClient(shim, original) {
    return function wrappedCreateClient() {
      const client = original.apply(this, arguments)
      client[opts] = getRedisParams(client.options)
      CMDS_TO_INSTRUMENT.forEach(instrumentClientCommand.bind(null, shim, client))
      return client
    }
  })
}

/**
 * Instruments a given command on the client by calling `shim.recordOperation`
 *
 * @param {Shim} shim shim instance
 * @param {object} client redis client instance
 * @param {string} cmd command to instrument
 */
function instrumentClientCommand(shim, client, cmd) {
  const { agent } = shim

  shim.recordOperation(client, cmd, function wrapCommand(_shim, _fn, _fnName, args) {
    const [key, value] = args
    const parameters = Object.assign({}, client[opts])
    // If selecting a database, subsequent commands
    // will be using said database, update the clientOptions
    // but not the current parameters(feature parity with v3)
    if (cmd.toLowerCase() === 'select') {
      client[opts].database_name = key
    }
    if (agent.config.attributes.enabled) {
      if (key) {
        parameters.key = JSON.stringify(key)
      }
      if (value) {
        parameters.value = JSON.stringify(value)
      }
    }

    return {
      name: (cmd && cmd.toLowerCase()) || 'other',
      parameters,
      promise: true
    }
  })
}

/**
 * Extracts the datastore parameters from the client options
 *
 * @param {object} clientOpts client.options
 * @returns {object} params
 */
function getRedisParams(clientOpts) {
  return {
    host: clientOpts?.socket?.host || 'localhost',
    port_path_or_id: clientOpts?.socket?.path || clientOpts?.socket?.port || '6379',
    database_name: clientOpts?.database || 0
  }
}

module.exports.getRedisParams = getRedisParams
