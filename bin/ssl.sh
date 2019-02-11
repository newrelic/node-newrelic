#! /bin/sh

CACONFIG="test/lib/test-ca.conf"
SSLKEY="test/lib/test-key.key"
CACERT="test/lib/ca-certificate.crt"
CAINDEX="test/lib/ca-index"
CASERIAL="test/lib/ca-serial"
CERTIFICATE="test/lib/self-signed-test-certificate.crt"

if [ -a $CERTIFICATE ]; then
  exit 0;
fi

openssl genrsa -out $SSLKEY 1024

touch $CAINDEX

echo 000a > $CASERIAL

openssl req \
  -new \
  -subj "/O=testsuite/OU=New Relic CA/CN=Node.js test CA" \
  -key $SSLKEY \
  -days 3650 \
  -x509 \
  -out $CACERT

openssl req \
  -new \
  -subj "/O=testsuite/OU=Node.js agent team/CN=ssl.lvh.me" \
  -key $SSLKEY \
  -out server.csr

openssl ca \
  -batch \
  -cert $CACERT \
  -config $CACONFIG \
  -keyfile $SSLKEY \
  -in server.csr \
  -out $CERTIFICATE

rm -f server.csr
