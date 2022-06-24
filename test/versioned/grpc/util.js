/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const util = module.exports
const { CLIENT_ADDR } = require('./constants')
const SERVER_ADDR = '0.0.0.0:50051'

util.getServer = async function getServer(grpc, proto) {
  const server = new grpc.Server()
  const credentials = grpc.ServerCredentials.createInsecure()
  // quick and dirty map to store metadata for a given gRPC call
  server.metadataMap = new Map()
  const serverMethods = require('./grpc-server')(server)

  server.addService(proto.Greeter.service, serverMethods)
  await new Promise((resolve, reject) => {
    server.bindAsync(SERVER_ADDR, credentials, (err, port) => {
      if (err) {
        reject(err)
      } else {
        resolve(port)
      }
    })
  })
  server.start()
  return server
}

util.getClient = function getClient(grpc, proto) {
  const credentials = grpc.credentials.createInsecure()
  return new proto.Greeter(CLIENT_ADDR, credentials)
}
