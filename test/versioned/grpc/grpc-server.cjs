/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { ERR_MSG, ERR_CODE, HALT_SERVER_ERR_MSG, HALT_CODE } = require('./constants.cjs')
const assert = require('node:assert')

function assertContext({ agent, name }) {
  if (agent) {
    const ctx = agent.tracer.getContext()
    assert.ok(ctx.transaction)
    assert.ok(ctx.segment)
    assert.equal(ctx.transaction.isActive(), true)
    assert.equal(ctx.segment.name, `/helloworld.Greeter/${name}`)
  }
}

module.exports = function createServerMethods(server, agent) {
  return {
    sayHello: function sayHello({ metadata, request: { name } }, cb) {
      assertContext({ agent, name: 'SayHello' })
      // add the metadata from client that the server receives so we can assert DT functionality
      server.metadataMap.set(name, metadata.internalRepr)
      const message = `Hello ${name}`
      cb(null, { message })
    },
    sayHelloClientStream: function sayHelloCStream(call, cb) {
      assertContext({ agent, name: 'SayHelloClientStream' })
      const { metadata } = call
      const names = []
      call.on('data', function (clientStream) {
        assertContext({ agent, name: 'SayHelloClientStream' })
        const { name } = clientStream
        server.metadataMap.set(name, metadata.internalRepr)
        names.push(name)
      })
      call.on('end', function () {
        assertContext({ agent, name: 'SayHelloClientStream' })
        cb(null, {
          message: `Hello ${names.join(', ')}`
        })
      })
    },
    sayHelloServerStream: function sayHelloServerStream(call) {
      assertContext({ agent, name: 'SayHelloServerStream' })
      const {
        metadata,
        request: { name }
      } = call
      name.forEach((n) => {
        // add the metadata from client that the server receives so we can assert DT functionality
        server.metadataMap.set(n, metadata.internalRepr)
        call.write({ message: `Hello ${n}` })
      })
      call.end()
    },
    sayHelloBidiStream: function sayHelloBidiStream(call) {
      assertContext({ agent, name: 'SayHelloBidiStream' })
      const { metadata } = call
      call.on('data', (clientStream) => {
        const { name } = clientStream
        // add the metadata from client that the server receives so we can assert DT functionality
        server.metadataMap.set(name, metadata.internalRepr)
        assertContext({ agent, name: 'SayHelloBidiStream' })
        call.write({ message: `Hello ${name}` })
      })
      call.on('end', () => {
        assertContext({ agent, name: 'SayHelloBidiStream' })
        call.end()
      })
    },
    sayError: function sayError(call, cb) {
      assertContext({ agent, name: 'SayError' })
      return cb({
        code: ERR_CODE,
        message: ERR_MSG
      })
    },
    sayErrorClientStream: function sayErrorClientStream(call, cb) {
      assertContext({ agent, name: 'SayErrorClientStream' })
      call.on('data', function (stream) {
        assertContext({ agent, name: 'SayErrorClientStream' })
        // have server send error mid-stream
        // when name matches `error`
        if (stream.name === 'error') {
          cb({
            code: HALT_CODE,
            message: HALT_SERVER_ERR_MSG
          })
        }
      })

      call.on('end', function () {
        assertContext({ agent, name: 'SayErrorClientStream' })
        cb({
          code: ERR_CODE,
          message: ERR_MSG
        })
      })
    },
    sayErrorServerStream: function sayErrorClientStream(call) {
      assertContext({ agent, name: 'SayErrorServerStream' })
      call.emit('error', {
        code: ERR_CODE,
        message: ERR_MSG
      })
    },
    sayErrorBidiStream: function sayErrorClientStream(call) {
      assertContext({ agent, name: 'SayErrorBidiStream' })
      call.emit('error', {
        code: ERR_CODE,
        message: ERR_MSG
      })
    }
  }
}
