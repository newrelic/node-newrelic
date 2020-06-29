#! /bin/sh

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

# https://www.gnu.org/software/bash/manual/html_node/The-Set-Builtin.html
set -e  # exit if any command fails
set -x  # be chatty and show the lines we're running

# LibreSSL fails on the openssl ca step for reasons
# that are mysterious and not understood, so let
# bail early if we detect that's the case
ENGINE_OPENSSL=`openssl version | awk '{print $(1)}'`
if [ "$ENGINE_OPENSSL" = "LibreSSL" ]
then
    echo "LibreSSL is not supported, please install a stock openssl and \n"
    echo "make sure that openssl binary is in your PATH"
    exit 1
fi

# CACONFIG is the only non-generated file
CACONFIG="test/lib/test-ca.conf"
SSLKEY="test/lib/test-key.key"
CACERT="test/lib/ca-certificate.crt"
CAINDEX="test/lib/ca-index"
CASERIAL="test/lib/ca-serial"
CERTIFICATE="test/lib/self-signed-test-certificate.crt"

# USAGE: ./bin/ssl.sh clear
# a sub command to remove all the generated files and start over
if [ "$1" = "clear" ]
then
    rm $SSLKEY
    rm $CACERT
    rm $CAINDEX
    rm $CASERIAL
    rm $CERTIFICATE
    exit 0
fi

# if there's already a certificate, then exit, but
# exit with a success code so build continue
if [ -e $CERTIFICATE ]; then
  exit 0;
fi

# generates an RSA key
openssl genrsa -out $SSLKEY 1024

# ca-index is the "certificate authority" database
# and ca-serial is a file that openssl will read
# "the next serial number for the ca-index entry"
# from.
touch $CAINDEX
echo 000a > $CASERIAL

# this generates a certificate for the
# certificate authority
openssl req \
  -new \
  -subj "/O=testsuite/OU=New Relic CA/CN=Node.js test CA" \
  -key $SSLKEY \
  -days 3650 \
  -x509 \
  -out $CACERT

# this generates a "certificate signing request" file
openssl req \
  -new \
  -subj "/O=testsuite/OU=Node.js agent team/CN=ssl.lvh.me" \
  -key $SSLKEY \
  -out server.csr

# using the files generated above, this tells the
# certificate authority about the request for a certificate,
# which generates the self-signed-test-certificate.crt file.
# This is the file used by the web server
openssl ca \
  -batch \
  -cert $CACERT \
  -config $CACONFIG \
  -keyfile $SSLKEY \
  -in server.csr \
  -out $CERTIFICATE

# remove the signing request now that we're done with it
rm -f server.csr
