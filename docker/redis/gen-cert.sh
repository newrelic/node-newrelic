#!/bin/bash

# Based upon https://github.com/redis/redis/blob/3a08819f5169f9702cde680acb6bf0c75fa70ffb/utils/gen-test-certs.sh

set -e

openssl genrsa -out ca.key 4096
openssl req \
  -x509 -new -nodes -sha256 \
  -key ca.key \
  -days 3650 \
  -subj '/O=Redis/CN=Certificate Authority'\
  -out ca.crt

openssl genrsa -out redis.key 2048
openssl req \
  -new -sha256 \
  -subj "/O=Redis/CN=redis" \
  -key redis.key | openssl x509 \
  -req \
  -sha256 \
  -CA ca.crt \
  -CAkey ca.key \
  -CAserial ca.txt \
  -CAcreateserial \
  -days 3650 \
  -out redis.crt
