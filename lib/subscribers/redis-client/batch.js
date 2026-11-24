/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const CmdQueueAddCmdSubscriber = require('./add-command')
const recordOperationMetrics = require('../../metrics/recorders/database-operation')
const { DB } = require('../../metrics/names')

/**
 * Base subscriber for `RedisClient._executeMulti`/`_executePipeline`.
 *
 * As of `@redis/client@6.4.0`, both methods submit their whole batch of
 * commands to the server in one round trip via `RedisCommandsQueue.addBatch`,
 * rather than calling `RedisCommandsQueue.addCommand` once per queued
 * command. That means there is a single async boundary for the entire batch,
 * so this creates one segment per queued command on `start` and closes all
 * of them out together on `asyncEnd`, rather than relying on individual
 * per-command completion.
 *
 * Extends `./add-command` purely to reuse its `setParameters` (host/port/
 * database plus key/value attributes from `ctx[redisClientOpts]`); its
 * single-segment `handler` is overridden below.
 */
class BatchSubscriber extends CmdQueueAddCmdSubscriber {
  constructor({ agent, logger, channelName, packageName = '@redis/client' }) {
    super({ agent, logger, packageName, channelName })
  }

  /**
   * The ordered list of command `args` arrays to create segments for.
   * Subclasses override this to account for commands the server sees that
   * are not present in the `commands` argument (e.g. the synthetic `MULTI`/
   * `EXEC` of a transaction).
   *
   * @param {Array} commands the queued user commands, as passed to
   * `_executeMulti`/`_executePipeline`
   * @returns {Array} `args` arrays, one per segment to create
   */
  getCommands(commands) {
    return commands.map(({ args }) => args)
  }

  handler(data, ctx) {
    const [commands] = data.arguments

    data.batchSegments = this.getCommands(commands).map((args) => {
      const [cmd, key, value] = args
      const operation = cmd ? String(cmd).toLowerCase() : 'other'
      this.setParameters({ ctx, key, value })

      const newCtx = this.createSegment({
        name: `${DB.OPERATION}/${this.system}/${operation}`,
        ctx,
        recorder: recordOperationMetrics.bind(this)
      })
      return newCtx.segment
    })

    return ctx
  }

  /**
   * Closes out the timing for every segment created in `handler` once the
   * batch's single promise settles.
   *
   * @param {object} data event passed to the `asyncEnd` hook
   */
  asyncEnd(data) {
    for (const segment of data.batchSegments ?? []) {
      segment?.touch()
    }
  }
}

module.exports = BatchSubscriber
