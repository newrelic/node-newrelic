#! /bin/sh

HOST=`docker-machine ip default 2>/dev/null`;

if test "$${HOST}"; then
  echo "Using docker-machine host through IP $${HOST}";
  export NR_NODE_TEST_MEMCACHED_HOST=$${HOST};
  export NR_NODE_TEST_MONGODB_HOST=$${HOST};
  export NR_NODE_TEST_MYSQL_HOST=$${HOST};
  export NR_NODE_TEST_REDIS_HOST=$${HOST};
  export NR_NODE_TEST_CASSANDRA_HOST=$${HOST};
  export NR_NODE_TEST_POSTGRES_HOST=$${HOST};
  export NR_NODE_TEST_RABBIT_HOST=$${HOST};
fi;