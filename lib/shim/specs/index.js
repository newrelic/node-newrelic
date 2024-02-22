/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { ARG_INDEXES } = require('./constants')

module.exports = {
  ARG_INDEXES,
  ClassWrapSpec: require('./class'),
  MessageSpec: require('./message'),
  MessageSubscribeSpec: require('./message-subscribe'),
  MiddlewareSpec: require('./middleware'),
  MiddlewareMounterSpec: require('./middleware-mounter'),
  OperationSpec: require('./operation'),
  QuerySpec: require('./query'),
  RecorderSpec: require('./recorder'),
  RenderSpec: require('./render'),
  SegmentSpec: require('./segment'),
  TransactionSpec: require('./transaction'),
  WrapSpec: require('./wrap'),

  params: {
    DatastoreParameters: require('./params/datastore'),
    QueueMessageParameters: require('./params/queue-message')
  }
}
