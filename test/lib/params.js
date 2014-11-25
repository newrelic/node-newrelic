module.exports = {
  memcached_host: process.env.NR_NODE_TEST_MEMCACHED_HOST || 'localhost',
  memcached_port: process.env.NR_NODE_TEST_MEMCACHED_PORT || 11211,

  mongodb_host: process.env.NR_NODE_TEST_MONGODB_HOST || 'localhost',
  mongodb_port: process.env.NR_NODE_TEST_MONGODB_PORT || 27017,

  mysql_host: process.env.NR_NODE_TEST_MYSQL_HOST || 'localhost',
  mysql_port: process.env.NR_NODE_TEST_MYSQL_PORT || 3306,

  redis_host: process.env.NR_NODE_TEST_REDIS_HOST || 'localhost',
  redis_port: process.env.NR_NODE_TEST_REDIS_PORT || 6379,

  cassandra_host: process.env.NR_NODE_TEST_CASSANDRA_HOST || 'localhost',
  cassandra_port: process.env.NR_NODE_TEST_CASSANDRA_PORT || 9042,

  postgres_host: process.env.NR_NODE_TEST_POSTGRES_HOST || 'localhost',
  postgres_port: process.env.NR_NODE_TEST_POSTGRES_PORT || 5432,
  postgres_user: process.env.NR_NODE_TEST_POSTGRES_USER || 'docker',
  postgres_pass: process.env.NR_NODE_TEST_POSTGRES_PASS || 'docker',
  postgres_db: process.env.NR_NODE_TEST_POSTGRES_DB || 'docker',

  oracle_host: process.env.NR_NODE_TEST_ORACLE_HOST || 'localhost',
  oracle_port: process.env.NR_NODE_TEST_ORACLE_PORT || 1521,
  oracle_user: process.env.NR_NODE_TEST_ORACLE_USER || 'system',
  oracle_pass: process.env.NR_NODE_TEST_ORACLE_PASS || 'oracle',
  oracle_db: process.env.NR_NODE_TEST_ORACLE_DB || 'xe'
}
