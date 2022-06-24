/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const grpc = require('@grpc/grpc-js')
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
        code: grpc.status.FAILED_PRECONDITION,
        message: 'i think i will cause problems on purpose'
      })
    }
  }
}
