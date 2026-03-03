/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseSubscriber = require('../base')
const { redisClientOpts } = require('../../symbols')

/**
 * Stores `RedisClient.options` on the Redis client via the symbol `RedisClient[redisClientOpts]`,
 * and then to the coordinating context via `ctx[redisClientOpts]`.
 *
 * We have to store the `redisClientOpts` symbol on the client directly because
 * the client could set up its options (e.g. selecting a database) outside of a
 * transaction, so we cannot rely on `ctx[redisClientOpts]` being sent.
 *
 * When `ctx` is valid (we're now in a transaction), we copy over
 * `RedisClient[redisClientOpts]` to `ctx[redisClientOpts]`.
 *
 * This is required because the subscriber responsible
 * for segment creation (`./add-command`) is listening to events on the
 * `RedisCommandQueue` class, and it does NOT have access to `RedisClient`.
 * It will read from `ctx[redisClientOpts]` to retrieve the datastore parameters
 * it needs.
 *
 * Any `RedisClient` method that calls `RedisClient.#queue.addCommand()` MUST
 * have a subscriber that extends from this class, so the `addCommand` subscriber
 * knows what the datastore parameters are.
 */
module.exports = class ClientPropagationSubscriber extends BaseSubscriber {
  constructor({ agent, logger, channelName, packageName = '@redis/client' }) {
    super({ agent, logger, packageName, channelName })
    this.requireActiveTx = false
  }

  handler(data, ctx) {
    // handler only fires when there's a transaction context
    // Transfer a COPY of the client opts to context, so that
    // updates to client opts don't affect the current context.
    // This ensures SELECT reports the old database, but subsequent
    // commands report the new database (feature parity with v3)
    const { self: client, arguments: args } = data
    if (!client[redisClientOpts]) {
      client[redisClientOpts] = this.getRedisParams(client.options)
    }

    if (ctx?.transaction && ctx.transaction.isActive()) {
      ctx[redisClientOpts] = Object.assign({}, client[redisClientOpts])
    }

    const newCtx = super.handler(data, ctx)
    // must be done after creating new context
    // as the select call must have the database_name that was currently
    // selected, not the one being selected
    this.updateSelectedDb({ client, args })
    return newCtx
  }

  /**
   * Updates the `database_name` in symbol on client
   * if the command is `select`
   *
   * @param {object} params to function
   * @param {object} params.client redis client instance
   * @param {Array} params.args arguments to function
   */
  updateSelectedDb({ client, args }) {
    if (!Array.isArray(args[0])) {
      return
    }

    const [cmd, db] = args[0]
    if (cmd.toLowerCase() === 'select') {
      client[redisClientOpts].database_name = db
    }
  }

  /**
   * Extracts the datastore parameters from the client options
   *
   * @param {object} clientOpts client.options
   * @returns {object} { host, port_path_or_id, database_name }
   */
  getRedisParams(clientOpts) {
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

    return {
      host: clientOpts?.host || clientOpts?.socket?.host || 'localhost',
      port_path_or_id:
        clientOpts?.port || clientOpts?.socket?.path || clientOpts?.socket?.port || '6379',
      database_name: clientOpts?.database || 0
    }
  }
}
