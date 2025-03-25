/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// These mappings are compliant with v1.24.0 and have mappings with v1.20.0 of semantic conventions
// https://github.com/open-telemetry/semantic-conventions/blob/v1.24.0/docs/database/database-spans.md

const constants = require('../constants')
const createMapper = require('./utils')
const attrMappings = {
  dynamoTable: {
    attrs: [constants.ATTR_DYNAMO_TABLE_NAMES]
  },
  name: {
    attrs: [constants.ATTR_DB_NAME],
    mapping({ segment }) {
      return (value) => segment.addAttribute('database_name', value)
    }
  },
  operation: {
    attrs: [constants.ATTR_DB_OPERATION]
  },
  port: {
    attrs: [constants.ATTR_NETWORK_PEER_PORT, constants.ATTR_NET_PEER_PORT],
    mapping({ segment }) {
      return (value) => segment.addAttribute('port_path_or_id', value)
    }
  },
  /*
   * This attribute was collected in `onStart`
   * and was passed to `ParsedStatement`. It adds
   * this segment attribute as `sql` or `sql_obfuscated`
   * and then when the span is built from segment
   * re-assigns to `db.statement`. This needs
   * to be skipped because it will be the raw value.
   */
  query: {
    attrs: [constants.ATTR_DB_STATEMENT],
    mapping() {
      return () => {}
    }
  },
  server: {
    attrs: [constants.ATTR_SERVER_ADDRESS, constants.ATTR_NET_PEER_NAME],
    mapping({ segment }) {
      return (value) => segment.addAttribute('host', value)
    }
  },
  system: {
    attrs: [constants.ATTR_DB_SYSTEM],
    mapping({ segment }) {
      return (value) => segment.addAttribute('product', value)
    }
  },
  table: {
    attrs: [constants.ATTR_DB_SQL_TABLE, constants.ATTR_MONGODB_COLLECTION]
  }
}

const { getAttr: dbAttr, attributesMapper } = createMapper(attrMappings)

function dbMapper({ segment }) {
  const dbPortMapping = attributesMapper({ key: 'port', segment })
  const dbServerMapping = attributesMapper({ key: 'server', segment })
  const dbNameMapping = attributesMapper({ key: 'name', segment })
  const dbSystemMapping = attributesMapper({ key: 'system', segment })
  const dbQueryMapping = attributesMapper({ key: 'query' })
  return {
    ...dbPortMapping,
    ...dbServerMapping,
    ...dbNameMapping,
    ...dbSystemMapping,
    ...dbQueryMapping
  }
}

module.exports = {
  dbAttr,
  dbMapper
}
