/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const CLIENT_COMMANDS = ['select', 'quit', 'SELECT', 'QUIT']

module.exports = function initialize(agent, redis, moduleName, shim) {
  shim.setDatastore(shim.REDIS)
  const COMMANDS = Object.keys(shim.require('dist/lib/client/commands.js').default)
  const CMDS_TO_INSTRUMENT = [...COMMANDS, ...CLIENT_COMMANDS]
  shim.wrap(redis, 'createClient', function wrapCreateClient(shim, original) {
    return function wrappedCreateClient() {
      const client = original.apply(this, arguments)
      const clientOptions = getRedisParams(client.options)
      CMDS_TO_INSTRUMENT.forEach((cmd) => {
        shim.recordOperation(client, cmd, function wrapCommand(shim, fn, fnName, args) {
          const [key, value] = args
          const parameters = Object.assign({}, clientOptions)
          // If selecting a database, subsequent commands
          // will be using said database, update the clientOptions
          // but not the current parameters(feature parity with v3)
          if (cmd.toLowerCase() === 'select') {
            clientOptions.database_name = key
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
      })

      return client
    }
  })

  /**
   * Extracts the datastore parameters from the client options
   *
   * @param {object} opts client.options
   * @returns {object} params
   */
  function getRedisParams(opts) {
    return {
      host: (opts.socket && opts.socket.host) || 'localhost',
      port_path_or_id: (opts.socket && (opts.socket.path || opts.socket.port)) || '6379',
      database_name: opts.database || 0
    }
  }
}
