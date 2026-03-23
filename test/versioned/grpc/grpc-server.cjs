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
let ADD_CONTEXT

/**
 * Returns a joined list of names from stream data
 * as well as a unique set of tx id and segment names(should only be one)
 *
 * @param {Array} data collection of { name, ctx }
 * @returns {object} { name, txId, segName }
 */
function extractStreamData(data) {
  const result = data.reduce((accum, curr) => {
    accum.names.push(curr.name)
    accum.txIds.add(curr.ctx?.transaction?.id)
    accum.segmentNames.add(curr?.ctx?.segment?.name)
    return accum
  }, { names: [], txIds: new Set(), segmentNames: new Set() })
  return {
    name: result.names.join(', '),
    txId: [...result.txIds].join(', '),
    segName: [...result.segmentNames].join(', ')
  }
}

module.exports = function createServerMethods(server, agent, addContextToResponse) {
  SERVER = server
  AGENT = agent
  ADD_CONTEXT = addContextToResponse

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
  const response = { message }
  ADD_CONTEXT({ response, key: 'cb', ctx })
  cb(null, response)
}

function sayHelloClientStream(call, cb) {
  const ctx = AGENT.tracer.getContext()
  const { metadata } = call
  const data = []
  call.on('data', function (clientStream) {
    const { name } = clientStream
    SERVER.metadataMap.set(name, metadata.internalRepr)
    const ctx = AGENT.tracer.getContext()
    data.push({ name, ctx })
  })
  call.on('end', function () {
    const endCtx = AGENT.tracer.getContext()
    const { name, txId, segName } = extractStreamData(data)
    const response = { message: `Hello ${name}` }
    ADD_CONTEXT({ response, key: 'cb', ctx })
    ADD_CONTEXT({ response, key: 'stream_end', ctx: endCtx })
    ADD_CONTEXT({ response, key: 'stream_data', ctx: { transaction: { id: txId }, segment: { name: segName } } })
    cb(null, response)
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
    const response = { message: `Hello ${n}` }
    ADD_CONTEXT({ response, key: 'cb', ctx })
    call.write(response)
  })
  call.end()
}

function sayHelloBidiStream(call) {
  const ctx = AGENT.tracer.getContext()
  const { metadata } = call
  call.on('data', (clientStream) => {
    const dataCtx = AGENT.tracer.getContext()
    const { name } = clientStream
    // add the metadata from client that the server receives so we can assert DT functionality
    SERVER.metadataMap.set(name, metadata.internalRepr)
    const response = { message: `Hello ${name}` }
    ADD_CONTEXT({ response, key: 'cb', ctx })
    ADD_CONTEXT({ response, key: 'stream_data', ctx: dataCtx })
    call.write(response)
  })
  call.on('end', () => {
    const endCtx = AGENT.tracer.getContext()
    const response = { message: 'end' }
    ADD_CONTEXT({ response, key: 'stream_end', ctx: endCtx })
    call.write(response)
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
