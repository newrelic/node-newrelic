/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'instrumentation.js',
  type: 'object',
  description: 'Stanza that contains all keys to disable core & 3rd party package instrumentation(i.e. dns, http, mongodb, pg, redis, etc) **Note**: Disabling a given library may affect the instrumentation of libraries used after the disabled library. Use at your own risk.',
  additionalProperties: {
    type: 'object',
    additionalProperties: true,
    properties: {
      enabled: {
        type: 'boolean',
        default: true,
        description: 'Whether instrumentation for this module is active.'
      }
    }
  },
  properties: {
    '@anthropic-ai/sdk': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@apollo/server': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@aws-sdk/smithy-client': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@azure/functions': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@elastic/elasticsearch': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@elastic/transport': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@google/adk': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@google/genai': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@grpc/grpc-js': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@hapi/hapi': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@hapi/vision': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@langchain/core': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@langchain/langgraph': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@modelcontextprotocol/sdk': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@modelcontextprotocol/sdk/client/index.js': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@nestjs/core': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@node-redis/client': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@opensearch-project/opensearch': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@prisma/client': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@redis/client': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@smithy/core': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    '@smithy/smithy-client': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    amqplib: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    'amqplib/callback_api': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    'aws-sdk': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    bluebird: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    bunyan: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    'cassandra-driver': {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    child_process: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    connect: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    crypto: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    dns: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    domain: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    express: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    fastify: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    fs: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    http: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    http2: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    https: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    inspector: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    ioredis: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    iovalkey: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    kafkajs: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    koa: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    memcached: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    mongodb: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    mysql: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    mysql2: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    net: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    next: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    openai: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    pg: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    pino: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    q: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    redis: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    restify: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    router: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    timers: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: false,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    undici: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    when: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    winston: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    },
    zlib: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Whether instrumentation for this module is active.'
        }
      }
    }
  }
}
