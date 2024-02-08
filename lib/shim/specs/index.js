/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { ARG_INDEXES } = require('./constants')
const MessageSpec = require('./message')
const MessageSubscribeSpec = require('./message-subscribe')
const MiddlewareSpec = require('./middleware')
const RecorderSpec = require('./recorder')
const RenderSpec = require('./render')
const SegmentSpec = require('./segment')
const WrapSpec = require('./wrap')

module.exports = {
  ARG_INDEXES,
  MessageSpec,
  MessageSubscribeSpec,
  MiddlewareSpec,
  RecorderSpec,
  RenderSpec,
  SegmentSpec,
  WrapSpec
}
