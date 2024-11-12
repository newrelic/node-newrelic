/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

exports.getServer = function getServer(cfg) {
  cfg = cfg || {}
  const host = cfg.host || 'localhost'
  const port = cfg.port || 0
  const opts = cfg.options || {}
  const hapi = cfg.hapi || require('@hapi/hapi')

  // v17 and later exports two references to the server object,
  // so we'll let fate decide which to use for a given test
  const servers = ['Server', 'server']
  const server = servers[Math.round(Math.random())]

  return hapi[server](Object.assign({}, opts, { host, port }))
}
