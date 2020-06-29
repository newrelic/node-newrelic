#! /bin/bash

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

IP=`docker-machine ip default 2>/dev/null`

export NR_NODE_TEST_CASSANDRA_HOST=$IP
export NR_NODE_TEST_MEMCACHED_HOST=$IP
export NR_NODE_TEST_MONGODB_HOST=$IP
export NR_NODE_TEST_MYSQL_HOST=$IP
export NR_NODE_TEST_ORACLE_HOST=$IP
export NR_NODE_TEST_POSTGRES_HOST=$IP
export NR_NODE_TEST_REDIS_HOST=$IP
export NR_NODE_TEST_RABBIT_HOST=$IP
