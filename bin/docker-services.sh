#! /bin/bash

if docker ps -a | grep -q "nr_node_memcached"; then
  docker start nr_node_memcached;
else
  docker run -d --name nr_node_memcached -p 11211:11211 memcached;
fi

if docker ps -a | grep -q "nr_node_mongodb"; then
  docker start nr_node_mongodb;
else
  docker run -d --name nr_node_mongodb -p 27017:27017 library/mongo:2;
fi

if docker ps -a | grep -q "nr_node_mysql"; then
  docker start nr_node_mysql;
else
  docker run -d --name nr_node_mysql \
    -e "MYSQL_ALLOW_EMPTY_PASSWORD=yes" \
    -e "MYSQL_ROOT_PASSWORD=" \
    -p 3306:3306 mysql:5;
fi

if docker ps -a | grep -q "nr_node_redis"; then
  docker start nr_node_redis;
else
  docker run -d --name nr_node_redis -p 6379:6379 redis;
fi

if docker ps -a | grep -q "nr_node_cassandra"; then
  docker start nr_node_cassandra;
else
  docker run -d --name nr_node_cassandra -p 9042:9042 zmarcantel/cassandra;
fi

if docker ps -a | grep -q "nr_node_postgres"; then
  docker start nr_node_postgres;
else
  docker run -d --name nr_node_postgres -p 5432:5432 postgres:9.2;
fi

if docker ps -a | grep -q "nr_node_rabbit"; then
  docker start nr_node_rabbit;
else
  docker run -d --name nr_node_rabbit -p 5672:5672 rabbitmq:3;
fi
