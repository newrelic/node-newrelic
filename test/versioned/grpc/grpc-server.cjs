/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  ERR_MSG,
  ERR_CODE,
  HALT_SERVER_ERR_MSG,
  HALT_CODE
} = require('./constants.cjs')

let SERVER
let AGENT

module.exports = function createServerMethods(server, agent) {
  SERVER = server
  AGENT = agent

  return {
    sayHello,
    sayHelloClientStream,
    sayHelloServerStream,
    sayHelloBidiStream,
    sayError,
    sayErrorClientStream,
    sayErrorServerStream: sayErrorStream,
    sayErrorBidiStream: sayErrorStream
  }
}

function sayHello({ metadata, request: { name } }, cb) {
  const ctx = AGENT.tracer.getContext()
  // add the metadata from client that the server receives so we can assert DT functionality
  SERVER.metadataMap.set(name, metadata.internalRepr)
  const message = `Hello ${name}`
  cb(null, {
    message,
    transaction_id: ctx.transaction?.id,
    segment_name: ctx.segment?.name
  })
}

function sayHelloClientStream(call, cb) {
  const ctx = AGENT.tracer.getContext()
  const { metadata } = call
  const names = []
  call.on('data', function (clientStream) {
    const { name } = clientStream
    SERVER.metadataMap.set(name, metadata.internalRepr)
    names.push(name)
  })
  call.on('end', function () {
    cb(null, {
      message: `Hello ${names.join(', ')}`,
      transaction_id: ctx.transaction?.id,
      segment_name: ctx.segment?.name
    })
  })
}

function sayHelloServerStream(call) {
  const ctx = AGENT.tracer.getContext()
  const {
    metadata,
    request: { name }
  } = call
  name.forEach((n) => {
    // add the metadata from client that the server receives so we can assert DT functionality
    SERVER.metadataMap.set(n, metadata.internalRepr)
    call.write({
      message: `Hello ${n}`,
      transaction_id: ctx.transaction?.id,
      segment_name: ctx.segment?.name
    })
  })
  call.end()
}

function sayHelloBidiStream(call) {
  const ctx = AGENT.tracer.getContext()
  const { metadata } = call
  call.on('data', (clientStream) => {
    const { name } = clientStream
    // add the metadata from client that the server receives so we can assert DT functionality
    SERVER.metadataMap.set(name, metadata.internalRepr)
    call.write({
      message: `Hello ${name}`,
      transaction_id: ctx.transaction?.id,
      segment_name: ctx.segment?.name
    })
  })
  call.on('end', () => {
    call.end()
  })
}

function sayError(call, cb) {
  return cb({
    code: ERR_CODE,
    message: ERR_MSG
  })
}

function sayErrorClientStream(call, cb) {
  call.on('data', function (stream) {
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
    cb({
      code: ERR_CODE,
      message: ERR_MSG
    })
  })
}

function sayErrorStream(call) {
  call.emit('error', {
    code: ERR_CODE,
    message: ERR_MSG
  })
}
