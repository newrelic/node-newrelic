/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { ARG_INDEXES } = require('./constants')
const ClassWrapSpec = require('./class')
const MessageSpec = require('./message')
const MessageSubscribeSpec = require('./message-subscribe')
const MiddlewareSpec = require('./middleware')
const MiddlewareMounterSpec = require('./middleware-mounter')
const OperationSpec = require('./operation')
const QuerySpec = require('./query')
const RecorderSpec = require('./recorder')
const RenderSpec = require('./render')
const SegmentSpec = require('./segment')
const TransactionSpec = require('./transaction')
const WrapSpec = require('./wrap')

module.exports = {
  ARG_INDEXES,
  ClassWrapSpec,
  MessageSpec,
  MessageSubscribeSpec,
  MiddlewareSpec,
  MiddlewareMounterSpec,
  OperationSpec,
  QuerySpec,
  RecorderSpec,
  RenderSpec,
  SegmentSpec,
  TransactionSpec,
  WrapSpec
}
