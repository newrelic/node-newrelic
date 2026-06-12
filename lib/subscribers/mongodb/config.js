/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const modName = 'mongodb'

module.exports = {
  [modName]: [
    {
      path: './mongodb/client.js',
      instrumentations: [{
        module: {
          name: modName,
          filePath: 'lib/mongo_client.js',
          versionRange: '>=4.1.4'
        },
        channelName: 'nr_client',
        functionQuery: {
          className: 'MongoClient',
          methodName: 'connect'
        }
      }]
    },

    {
      path: './mongodb/db.js',
      instrumentations: [{
        module: {
          name: modName,
          filePath: 'lib/db.js',
          versionRange: '>=4.1.4'
        },
        channelName: 'nr_db',
        functionQuery: {
          className: 'Db'
        }
      }]
    },

    {
      path: './mongodb/cursor.js',
      instrumentations: [{
        module: {
          name: modName,
          filePath: 'lib/cursor/abstract_cursor.js',
          versionRange: '>=4.1.4'
        },
        channelName: 'nr_cursor',
        functionQuery: {
          className: 'AbstractCursor'
        }
      }]
    },

    {
      path: './mongodb/collection.js',
      instrumentations: [{
        module: {
          name: modName,
          filePath: 'lib/collection.js',
          versionRange: '>=4.1.4'
        },
        channelName: 'nr_collection',
        functionQuery: {
          className: 'Collection'
        }
      }]
    },

    {
      path: './mongodb/bulk.js',
      instrumentations: [{
        module: {
          name: modName,
          filePath: 'lib/bulk/common.js',
          versionRange: '>=4.1.4'
        },
        channelName: 'nr_bulk',
        functionQuery: {
          className: 'BulkOperationBase'
        }
      }]
    }
  ]
}
