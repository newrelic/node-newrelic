/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MessageSpec } = require('../../shim/specs')

// RPC API calls
// https://cloud.google.com/pubsub/docs/reference/rpc
const PUBLISHER_COMMANDS = ['Publish'] // topic.publishMessage(); https://github.com/googleapis/nodejs-pubsub/blob/main/samples/publishMessage.js 
const SUBSCRIBER_COMMANDS = ['Pull', 'StreamingPull'] // subClient.pull(request); https://github.com/googleapis/nodejs-pubsub/blob/main/samples/synchronousPull.js

// Are we just adding attributes (e.g. messaging) to the REST/RPC API external calls?
// Or are we instrumenting the actual code itself?