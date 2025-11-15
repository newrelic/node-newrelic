/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  // only here to properly track when using callback API
  'amqplib/callback_api': [],
  amqplib: [
    {
      path: './amqplib/connect.js',
      instrumentations: [
        {
          channelName: 'nr_connect',
          module: { name: 'amqplib', versionRange: '>=0.5.0', filePath: 'lib/connect.js' },
          functionQuery: {
            functionName: 'connect',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './amqplib/send-message.js',
      instrumentations: [
        {
          channelName: 'nr_sendMessage',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/channel.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'sendMessage',
            kind: 'Sync'
          }
        },
        {
          channelName: 'nr_sendMessage',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/channel.js' },
          functionQuery: {
            expressionName: 'sendMessage',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './amqplib/consume.js',
      instrumentations: [
        {
          channelName: 'nr_consume',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'consume',
            kind: 'Sync'
          }
        },
        {
          channelName: 'nr_consume',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'consume',
            kind: 'Sync'
          }
        },
        {
          channelName: 'nr_consume',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'consume',
            kind: 'Sync'
          }
        },
        {
          channelName: 'nr_consume',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'consume',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './amqplib/purge-queue.js',
      instrumentations: [
        {
          channelName: 'nr_purgeQueue',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'purgeQueue',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_purgeQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'purgeQueue',
            kind: 'Async'
          }
        }
      ]
    },
    {
      path: './amqplib/purge-queue-cb.js',
      instrumentations: [
        {
          channelName: 'cb_purgeQueue',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'purgeQueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_purgeQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'purgeQueue',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './amqplib/get.js',
      instrumentations: [
        {
          channelName: 'nr_get',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'get',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_get',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'get',
            kind: 'Async'
          }
        }
      ]
    },
    {
      path: './amqplib/get-cb.js',
      instrumentations: [
        {
          channelName: 'cb_get',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'get',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_get',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'get',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './amqplib/channel-model.js',
      instrumentations: [
        {
          channelName: 'nr_assertExchange',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'assertExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_assertQueue',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'assertQueue',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_close',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'close',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_open',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'open',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_bindQueue',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'bindQueue',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_checkQueue',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'checkQueue',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_unbindQueue',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'unbindQueue',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_checkExchange',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'checkExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_deleteExchange',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'deleteExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_bindExchange',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'bindExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_unbindExchange',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'unbindExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_cancel',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'cancel',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_prefetch',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            // Note: method name is not `prefetch` as `qos` is mapped to it
            methodName: 'qos',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_recover',
          module: { name: 'amqplib', versionRange: '>=0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'recover',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_assertExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'assertExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_assertQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'assertQueue',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_close',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'close',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_open',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'open',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_bindQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'bindQueue',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_checkQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'checkQueue',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_unbindQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'unbindQueue',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_checkExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'checkExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_deleteExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'deleteExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_bindExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'bindExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_unbindExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'unbindExchange',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_cancel',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'cancel',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_prefetch',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            // Note: method name is not `prefetch` as `qos` is mapped to it
            expressionName: 'qos',
            kind: 'Async'
          }
        },
        {
          channelName: 'nr_recover',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.9.0', filePath: 'lib/channel_model.js' },
          functionQuery: {
            expressionName: 'recover',
            kind: 'Async'
          }
        }
      ]
    },
    {
      path: './amqplib/send-or-enqueue.js',
      instrumentations: [
        {
          channelName: 'nr_sendOrEnqueue',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/channel.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'sendOrEnqueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'nr_sendOrEnqueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/channel.js' },
          functionQuery: {
            expressionName: 'sendOrEnqueue',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './amqplib/accept-message.js',
      instrumentations: [
        {
          channelName: 'nr_acceptMessage',
          module: { name: 'amqplib', versionRange: '>=0.5.0', filePath: 'lib/channel.js' },
          functionQuery: {
            functionName: 'acceptMessage',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './amqplib/callback-model.js',
      instrumentations: [
        {
          channelName: 'cb_assertExchange',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'assertExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_assertQueue',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'assertQueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_close',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'close',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_open',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'open',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_bindQueue',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'bindQueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_checkQueue',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'checkQueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_unbindQueue',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'unbindQueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_checkExchange',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'checkExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_deleteExchange',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'deleteExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_bindExchange',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'bindExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_unbindExchange',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'unbindExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_cancel',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'cancel',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_prefetch',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'prefetch',
            kind: 'Ssync'
          }
        },
        {
          channelName: 'cb_recover',
          module: { name: 'amqplib', versionRange: '>=0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            className: 'Channel',
            methodName: 'recover',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_assertExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'assertExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_assertQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {

            expressionName: 'assertQueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_close',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'close',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_open',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'open',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_bindQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'bindQueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_checkQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'checkQueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_unbindQueue',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'unbindQueue',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_checkExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'checkExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_deleteExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'deleteExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_bindExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'bindExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_unbindExchange',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'unbindExchange',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_cancel',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'cancel',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_prefetch',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'prefetch',
            kind: 'Sync'
          }
        },
        {
          channelName: 'cb_recover',
          module: { name: 'amqplib', versionRange: '>=0.5.0 <0.10.4', filePath: 'lib/callback_model.js' },
          functionQuery: {
            expressionName: 'recover',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
