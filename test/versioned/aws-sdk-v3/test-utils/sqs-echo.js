/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Patches the SQS client's `.send` method to attach the outgoing SQS message
 * to the _response_ SQS message under the key `nrSendCommand`. This allows us
 * to verify that our instrumentation has attached things like distributed
 * trace headers to the outgoing message. We cannot do this from the mock
 * SQS server because the `aws-sdk` internals will strip any non-schematized
 * fields before forwarding the response back to the user.
 *
 * @param {object} params Function parameters.
 * @param {object} params.http The standard `node:http` module. This should
 * have been patched by the agent prior to be supplied to this function.
 * @param {object} params.sqsClient The SQS client instance to patch.
 * @param {object} params.sqs The actual result of
 * `require('@aws-sdk/client-sqs')`.
 * @param {object} params.cmd The full SQS command to provide to the client
 * when sending the request.
 *
 * @returns {object} Has a `server` property set to the server instance and
 * an `address` property set to the full HTTP URL for the listening server.
 */
module.exports = async function sqsEcho({ http, sqsClient, sqs, cmd }) {
  const send = sqsClient.send
  sqsClient.send = async (...args) => {
    // 1. This `send.apply` goes through our instrumentation of the
    // `awsSdk.send` method. Our method will mutate the `SendMessageCommand`
    // instance that is being sent to "AWS".
    // 2. The `result` object will be the object that has been parsed and
    // filtered by the SDK (i.e. any extra data our custom server returns
    // in the response will be stripped).
    // 3. Combining these things, we are able to attach enough data to the
    // result in order to verify things like distributed trace headers being
    // sent correctly.
    const result = await send.apply(sqsClient, args)
    result.nrSendCommand = args[0].input
    return result
  }

  const server = http.createServer((req, res) => {
    const msg = new sqs.SendMessageCommand(cmd)
    sqsClient.send(msg)
      .then((result) => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(result))
      })
  })

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  return {
    server,
    address: `http://${server.address().address}:${server.address().port}`
  }
}
