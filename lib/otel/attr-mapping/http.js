/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const constants = require('../constants')
const createMapper = require('./utils')
const { DESTINATIONS } = require('../../config/attribute-filter')

// These mappings are compliant with v1.23.0 and have mappings with v1.20.0 of semantic conventions
// https://github.com/open-telemetry/semantic-conventions/blob/v1.23.0/docs/http/http-spans.md

const attrMappings = {
  clientHost: {
    attrs: [constants.ATTR_SERVER_ADDRESS, constants.ATTR_NET_PEER_NAME],
    mapping() {
      return () => {}
    }
  },
  clientPort: {
    attrs: [constants.ATTR_SERVER_PORT, constants.ATTR_NETWORK_PEER_PORT, constants.ATTR_NET_PEER_PORT],
    mapping() {
      return () => {}
    }
  },
  clientUrl: {
    attrs: [constants.ATTR_FULL_URL, constants.ATTR_HTTP_URL],
    mapping() {
      return () => {}
    }
  },
  grpcStatusCode: {
    attrs: [constants.ATTR_GRPC_STATUS_CODE],
    mapping({ segment, transaction }) {
      return (value) => {
        transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'response.status', value)
        segment.addAttribute(constants.ATTR_GRPC_STATUS_CODE, value)
      }
    }
  },
  rpcMethod: {
    attrs: [constants.ATTR_RPC_METHOD],
    mapping({ transaction }) {
      return (value) => transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'request.method', value)
    }
  },
  rpcSystem: {
    attrs: [constants.ATTR_RPC_SYSTEM],
    mapping({ segment }) {
      return (value) => segment.addAttribute('component', value)
    }
  },
  rpcService: {
    attrs: [constants.ATTR_RPC_SERVICE],
  },
  host: {
    attrs: [constants.ATTR_SERVER_ADDRESS, constants.ATTR_NET_HOST_NAME],
    mapping({ segment }) {
      return (value) => {
        segment.addAttribute('host', value)
      }
    }
  },
  method: {
    attrs: [constants.ATTR_HTTP_REQUEST_METHOD, constants.ATTR_HTTP_METHOD],
    mapping({ transaction }) {
      return (value) => {
        if (transaction) {
          transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'request.method', value)
        }
      }
    }
  },
  port: {
    attrs: [constants.ATTR_SERVER_PORT, constants.ATTR_NET_HOST_PORT],
    mapping({ segment }) {
      return (value) => {
        segment.addAttribute('port', value)
      }
    }
  },
  route: {
    attrs: [constants.ATTR_HTTP_ROUTE],
    mapping({ segment, transaction }) {
      return (value) => {
        transaction.nameState.appendPath(value)
        segment.addAttribute('http.route', value)
      }
    }
  },
  statusCode: {
    attrs: [constants.ATTR_HTTP_RES_STATUS_CODE, constants.ATTR_HTTP_STATUS_CODE],
    mapping({ segment, transaction }) {
      return (value) => {
        if (segment) {
          segment.addAttribute('http.statusCode', value)
        } else {
          transaction.statusCode = value
          transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'http.statusCode', value)
        }
      }
    }
  },
  statusText: {
    attrs: [constants.ATTR_HTTP_STATUS_TEXT],
    mapping({ segment, transaction }) {
      return (value) => {
        if (segment) {
          segment.addAttribute('http.statusText', value)
        } else {
          transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'http.statusText', value)
        }
      }
    }
  },
  url: {
    attrs({ span }) {
      let value
      if (span.attributes[constants.ATTR_HTTP_URL]) {
        value = span.attributes[constants.ATTR_HTTP_URL]
      } else {
        const protocol = span.attributes[constants.ATTR_URL_SCHEME] ?? 'https'
        const host = span.attributes[constants.ATTR_SERVER_ADDRESS] ?? 'unknown'
        const port = span.attributes[constants.ATTR_SERVER_PORT]
        const path = span.attributes[constants.ATTR_URL_PATH] ?? '/unknown'
        const qp = span.attributes[constants.ATTR_URL_QUERY]
        value = `${protocol}://${host}`
        if (port) {
          value += `:${port}`
        }
        value += path
        if (qp) {
          value += qp
        }
      }

      return value
    }
  }
}

const { getAttr: httpAttr, attributesMapper } = createMapper(attrMappings)

function rpcMapper({ segment, transaction }) {
  const statusMapping = attributesMapper({ key: 'grpcStatusCode', segment, transaction })
  const systemMapping = attributesMapper({ key: 'rpcSystem', segment })
  const rpcMethodMapping = attributesMapper({ key: 'rpcMethod', transaction })
  return {
    ...rpcMethodMapping,
    ...statusMapping,
    ...systemMapping
  }
}

function serverMapper({ segment, transaction }) {
  // TODO: if route params are available, assign them as well
  const methodMapping = attributesMapper({ key: 'method', transaction })
  const statusCodeMapping = attributesMapper({ key: 'statusCode', transaction })
  const statusTextMapping = attributesMapper({ key: 'statusText', transaction })
  const serverPortMapping = attributesMapper({ key: 'port', segment })
  const httpRouteMapping = attributesMapper({ key: 'route', segment, transaction })
  const httpHostMapping = attributesMapper({ key: 'host', segment, transaction })
  return {
    ...httpHostMapping,
    ...httpRouteMapping,
    ...methodMapping,
    ...serverPortMapping,
    ...statusCodeMapping,
    ...statusTextMapping
  }
}

function clientMapper({ segment }) {
  const statusCodeMapping = attributesMapper({ key: 'statusCode', segment })
  const statusTextMapping = attributesMapper({ key: 'statusText', segment })
  const clientHostMapping = attributesMapper({ key: 'clientHost', segment })
  const clientUrlMapping = attributesMapper({ key: 'clientUrl', segment })
  const clientPortMapping = attributesMapper({ key: 'clientPort', segment })
  return {
    ...clientHostMapping,
    ...clientPortMapping,
    ...clientUrlMapping,
    ...statusCodeMapping,
    ...statusTextMapping
  }
}

module.exports = {
  clientMapper,
  httpAttr,
  rpcMapper,
  serverMapper,
}
