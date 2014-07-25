FROM node

# These should be in .ci.yml, but DotCI's envvar support seems broken
ENV NR_NODE_TEST_MEMCACHED_HOST docker-memcached
ENV NR_NODE_TEST_MONGODB_HOST mongodb
ENV NR_NODE_TEST_MYSQL_HOST mysql
ENV NR_NODE_TEST_REDIS_HOST redis
ENV NR_NODE_TEST_CASSANDRA_HOST cassandra
ENV NR_NODE_TEST_POSTGRES_HOST postgresql

RUN apt-get install -y time

ADD . /usr/src/app
WORKDIR /usr/src/app
