/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  OperationSpec,
  params: { DatastoreParameters },
  ClassWrapSpec
} = require('../../shim/specs')
const { redisClientOpts } = require('../../symbols')

module.exports = function initialize(_agent, redis, _moduleName, shim) {
  shim.setDatastore(shim.REDIS)
  const commandsQueue = shim.require('dist/lib/client/commands-queue.js')

  shim.wrapClass(
    commandsQueue,
    'default',
    new ClassWrapSpec({
      post: function postConstructor(shim) {
        instrumentAddCommand({ shim, commandsQueue: this })
      }
    })
  )

  shim.wrap(redis, 'createClient', function wrapCreateClient(_shim, createClient) {
    return function wrappedCreateClient(options) {
      // saving connection opts to shim
      // since the RedisCommandsQueue gets constructed at createClient
      // we can delete the symbol afterwards to ensure the appropriate
      // connection options are for the given RedisCommandsQueue
      shim[redisClientOpts] = getRedisParams(options)
      const client = createClient.apply(this, arguments)
      delete shim[redisClientOpts]
      return client
    }
  })
}

/**
 * Instruments a given command when added to the command queue by calling `shim.recordOperation`
 *
 * @param {object} params params object
 * @param {Shim} params.shim shim instance
 * @param {object} params.commandsQueue instance
 */
function instrumentAddCommand({ shim, commandsQueue }) {
  const { agent } = shim
  const clientOpts = shim[redisClientOpts]

  shim.recordOperation(
    commandsQueue,
    'addCommand',
    function wrapAddCommand(_shim, _fn, _fnName, args) {
      const [cmd, key, value] = args[0]
      const parameters = Object.assign({}, clientOpts)
      // If selecting a database, subsequent commands
      // will be using said database, update the clientOpts
      // but not the current parameters(feature parity with v3)
      if (cmd.toLowerCase() === 'select') {
        clientOpts.database_name = key
      }
      if (agent.config.attributes.enabled) {
        if (key) {
          parameters.key = JSON.stringify(key)
        }
        if (value) {
          parameters.value = JSON.stringify(value)
        }
      }

      return new OperationSpec({
        name: (cmd && cmd.toLowerCase()) || 'other',
        parameters,
        promise: true
      })
    }
  )
}

/**
 * Extracts the datastore parameters from the client options
 *
 * @param {object} clientOpts client.options
 * @returns {object} params
 */
function getRedisParams(clientOpts) {
  // need to replicate logic done in RedisClient
  // to parse the url to assign to socket.host/port
  // see: https://github.com/redis/node-redis/blob/5576a0db492cda2cd88e09881bc330aa956dd0f5/packages/client/lib/client/index.ts#L160
  if (clientOpts?.url) {
    const parsedURL = new URL(clientOpts.url)
    clientOpts.socket = Object.assign({}, clientOpts.socket, { host: parsedURL.hostname })
    if (parsedURL.port) {
      clientOpts.socket.port = parsedURL.port
    }

    if (parsedURL.pathname) {
      clientOpts.database = parsedURL.pathname.substring(1)
    }
  }

  return new DatastoreParameters({
    host: clientOpts?.host || clientOpts?.socket?.host || 'localhost',
    port_path_or_id:
      clientOpts?.port || clientOpts?.socket?.path || clientOpts?.socket?.port || '6379',
    database_name: clientOpts?.database || 0
  })
}

module.exports.getRedisParams = getRedisParams
