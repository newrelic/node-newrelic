/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Patches in a server.destroy method, which closes a server immediately
 * by destroying any remaining open sockets.
 * @param server An HTTP(S) server, from http(s).createServer
 */
exports.patchDestroy = function (server) {
  const sockets = new Set()
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => {
      sockets.delete(socket)
    })
  })
  server.destroy = function () {
    sockets.forEach((socket) => {
      socket.destroy()
    })
    server.close()
  }
}
