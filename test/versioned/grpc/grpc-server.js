/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { ERR_MSG, ERR_CODE } = require('./constants')
module.exports = function createServerMethods(server) {
  return {
    sayHello: function sayHello({ metadata, request: { name } }, cb) {
      // add the metadata from client that the server receives so we can assert DT functionality
      server.metadataMap.set(name, metadata.internalRepr)
      const message = `Hello ${name}`
      cb(null, { message })
    },
    sayHelloClientStream: function sayHelloCStream(call, cb) {
      const { metadata } = call
      const names = []
      call.on('data', function (clientStream) {
        const { name } = clientStream
        server.metadataMap.set(name, metadata.internalRepr)
        names.push(name)
      })
      call.on('end', function () {
        cb(null, {
          message: `Hello ${names.join(', ')}`
        })
      })
    },
    sayHelloServerStream: function sayHelloCStream(call) {
      const {
        metadata,
        request: { name }
      } = call
      name.forEach((n) => {
        server.metadataMap.set(n, metadata.internalRepr)
        call.write({ message: `Hello ${n}` })
      })
      call.end()
    },
    sayHelloBidiStream: function sayHelloCStream(call) {
      const { metadata } = call
      call.on('data', (clientStream) => {
        const { name } = clientStream
        server.metadataMap.set(name, metadata.internalRepr)
        call.write({ message: `Hello ${name}` })
      })
      call.on('end', () => {
        call.end()
      })
    },
    sayError: function sayError(whatever, cb) {
      return cb({
        code: ERR_CODE,
        message: ERR_MSG
      })
    },
    sayErrorClientStream: function sayErrorClientStream(call, cb) {
      call.on('data', function () {
        // no-op as we do not care about the data
      })

      call.on('end', function () {
        cb({
          code: ERR_CODE,
          message: ERR_MSG
        })
      })
    },
    sayErrorServerStream: function sayErrorClientStream(call) {
      call.emit('error', {
        code: ERR_CODE,
        message: ERR_MSG
      })
    },
    sayErrorBidiStream: function sayErrorClientStream(call) {
      call.emit('error', {
        code: ERR_CODE,
        message: ERR_MSG
      })
    }
  }
}
