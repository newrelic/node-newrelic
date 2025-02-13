/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Attribute values are found at:
// https://opentelemetry.io/docs/specs/semconv/attributes-registry/
// Attribute constant names are found at:
// https://github.com/open-telemetry/opentelemetry-js/tree/e744798957ac6d980673262a61634f066d9f66a3/semantic-conventions/src

/**
 * Provides a hash of constant attribute names to attribute values as defined
 * by the OTEL semantic conventions. The values and names are still very much
 * in flux (2025-02). As a result, it is easier for us to copy the ones we need
 * here.
 *
 * 1. Everything should be listed in alphabetical order.
 * 2. If an attribute can have multiple names, but all have a common value,
 * only list one constant for us to standardize on internally. Make notes of
 * the other possible upstream names within the jsdoc for the attribute. If they
 * have different values, include multiple attributes with documentation
 * referencing which should be favored.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/
 *
 * @type {object}
 */
module.exports = {
  /**
   * Name of the database (schema) being accessed.
   */
  ATTR_DB_NAME: 'db.name',

  /**
   * The name of the database operation being performed.
   *
   * @example select
   * @example findAndModify
   */
  ATTR_DB_OPERATION: 'db.operation',

  /**
   * The table name that is targeted in the operation.
   */
  ATTR_DB_SQL_TABLE: 'db.sql.table',

  /**
   * The database statement being executed.
   *
   * @example select * from foo
   */
  ATTR_DB_STATEMENT: 'db.statement',

  /**
   * Name of the remote database technology being accessed.
   *
   * @example mysql
   * @see https://opentelemetry.io/docs/specs/semconv/database/sql/
   */
  ATTR_DB_SYSTEM: 'db.system',

  /**
   * The full resource URL.
   *
   * @example https://example.com/foo?bar=baz
   */
  ATTR_FULL_URL: 'url.full',

  /**
   * The [numeric status code](https://github.com/grpc/grpc/blob/v1.33.2/doc/statuscodes.md) of the gRPC request.
   */
  ATTR_GRPC_STATUS_CODE: 'rpc.grpc.status_code',

  /**
   * Value of the HTTP `host` header.
   *
   * {@link ATTR_HTTP_REQUEST_METHOD} is newer and should be used instead.
   */
  ATTR_HTTP_HOST: 'http.host',

  /**
   * The HTTP request method, e.g. `GET` or `POST`.
   */
  ATTR_HTTP_METHOD: 'http.method',

  /**
   * HTTP method used for the request, e.g. `GET` or `POST`.
   */
  ATTR_HTTP_REQUEST_METHOD: 'http.request.method',

  /**
   * Framework representation for a route, may include parameter tokens.
   *
   * @example /orders/:order_id
   */
  ATTR_HTTP_ROUTE: 'http.route',

  /**
   * The full resource URL.
   *
   * {@link ATTR_FULL_URL} is newer and should be used instead.
   *
   * @example https://example.com/foo?bar=baz
   */
  ATTR_HTTP_URL: 'http.url',

  /**
   * The http response status code
   *
   * @example 200
   */
  ATTR_HTTP_STATUS_CODE: 'http.response.status_code',

  /**
   * The http response status text
   *
   * @example OK
   */
  ATTR_HTTP_STATUS_TEXT: 'http.status_text',

  /**
   * The correlation id
   *
   * @example MyConversationId
   */
  ATTR_MESSAGING_MESSAGE_CONVERSATION_ID: 'messaging.message.conversation_id',

  /**
   * The message destination name.
   *
   * {@link ATTR_MESSAGING_DESTINATION_NAME} is newer and should be used.
   */
  ATTR_MESSAGING_DESTINATION: 'messaging.destination',

  /**
   * The kind of message destination (don't really know, this is what the
   * otel code calls it).
   */
  ATTR_MESSAGING_DESTINATION_KIND: 'messaging.destination_kind',

  /**
   * The target queue name for the message to be delivered to.
   *
   * @example MyQueue
   * @example MyTopic
   */
  ATTR_MESSAGING_DESTINATION_NAME: 'messaging.destination.name',

  /**
   * Identifies the type of messaging consumer operation.
   *
   * {@link ATTR_MESSAGING_OPERATION_NAME} is newer and should be used.
   */
  ATTR_MESSAGING_OPERATION: 'messaging.operation',

  /**
   * Name of the operation being performed. Value is specific to the
   * target messaging system.
   *
   * @example ack
   * @example send
   */
  ATTR_MESSAGING_OPERATION_NAME: 'messaging.operation.name',

  /**
   * RabbitMQ message routing key
   *
   * @example myKey
   */
  ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY: 'messaging.rabbitmq.destination.routing_key',

  /**
   * Target messaging system name.
   *
   * @example kafka
   * @see https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/
   */
  ATTR_MESSAGING_SYSTEM: 'messaging.system',

  /**
   * The collection being accessed.
   */
  ATTR_MONGODB_COLLECTION: 'db.mongodb.collection',

  /**
   * Remote host name.
   */
  ATTR_NET_PEER_NAME: 'net.peer.name',

  /**
   * Remote port number.
   */
  ATTR_NET_PEER_PORT: 'net.peer.port',

  /**
   * The name of the remote method being invoked.
   */
  ATTR_RPC_METHOD: 'rpc.method',

  /**
   * The logical name of the service being called.
   *
   * @example myservice.EchoService
   */
  ATTR_RPC_SERVICE: 'rpc.service',

  /**
   * Defines the RPC technology being instrumented. Will be a string name
   * for a known RPC system.
   *
   * @example grpc
   * @see https://opentelemetry.io/docs/specs/semconv/rpc/rpc-spans/
   */
  ATTR_RPC_SYSTEM: 'rpc.system',

  /**
   * Server domain name, IP address, or Unix domain socket.
   *
   * @example example.com
   * @example 10.1.2.80
   * @example /tmp/my.sock
   */
  ATTR_SERVER_ADDRESS: 'server.address',
  ATTR_NET_HOST_NAME: 'net.host.name',

  /**
   * Poort of the local HTTP server that received the request.
   *
   * @example 80
   */
  ATTR_SERVER_PORT: 'server.port',
  ATTR_NET_HOST_PORT: 'net.host.port',

  /**
   * Logical name of the local service being instrumented.
   */
  ATTR_SERVICE_NAME: 'service.name',

  /**
   * URL path component, e.g. `/foo` in `http://example.com/foo`. This is
   * the fully realized path. See {@link ATTR_HTTP_ROUTE} for the framework
   * representation.
   */
  ATTR_URL_PATH: 'url.path',

  /**
   * The scheme value for the URL.
   *
   * @example https
   */
  ATTR_URL_SCHEME: 'url.scheme',

  /* !!! Miscellaneous !!! */
  /**
   * Database system names.
   *
   * @example mysql
   */
  DB_SYSTEM_VALUES: {
    ADABAS: 'adabas',
    CACHE: 'cache',
    CASSANDRA: 'cassandra',
    CLOUDSCAPE: 'cloudscape',
    COCKROACHDB: 'cockroachdb',
    COLDFUSION: 'coldfusion',
    COSMOSDB: 'cosmosdb',
    COUCHBASE: 'couchbase',
    COUCHDB: 'couchdb',
    DB2: 'DB2',
    DERBY: 'derby',
    DYNAMODB: 'dynamodb',
    EDB: 'edb',
    ELASTICSEARCH: 'elasticsearch',
    FILEMAKER: 'filemaker',
    FIREBIRD: 'firebird',
    FIRSTSQL: 'firstsql',
    GEODE: 'geode',
    H2: 'h2',
    HANADB: 'handadb',
    HBASE: 'hbase',
    HIVE: 'hive',
    HSQLDB: 'hsqldb',
    INFORMIX: 'informix',
    INGRESS: 'ingres',
    INSTANTDB: 'instantdb',
    INTERBASE: 'interbase',
    MARIADB: 'mariadb',
    MAXDB: 'maxdb',
    MEMCACHED: 'memcached',
    MONGODB: 'mongodb',
    MSSQL: 'mssql',
    MYSQL: 'mysql',
    NEO4J: 'neo4j',
    NETEZZA: 'netezza',
    ORACLE: 'oracle',
    OTHER_SQL: 'other_sql',
    PERVASIVE: 'pervasive',
    POINTBASE: 'pointbase',
    POSTGRESQL: 'postgresql',
    PROGRESS: 'progress',
    REDIS: 'redis',
    REDSHIFT: 'redshift',
    SQLITE: 'sqlite',
    SYBASE: 'sybase',
    TERADATA: 'teradata',
    VERTICA: 'vertica',
  },

  /**
   * Kinds of messaging system destinations.
   */
  MESSAGING_SYSTEM_KIND_VALUES: {
    QUEUE: 'queue',
    TOPIC: 'topic'
  }
}
