#! /bin/bash

function get_gcc_version {
  local gcc_version_match='[[:digit:]]\.[[:digit:]]\.[[:digit:]]'
  local gcc_version=`$CC --version 2>/dev/null | grep -o "$gcc_version_match" | head -1`
  echo $gcc_version | grep -o '[[:digit:]]' | head -1
}

TOOLCHAIN_ADDED="false"
function add_toolchain {
  if [ "$TOOLCHAIN_ADDED" == "false" ]; then
    sudo add-apt-repository ppa:ubuntu-toolchain-r/test -y
    sudo apt-get update -qq
  fi
  TOOLCHAIN_ADDED="true"
}

# Only upgrade GCC if we need to.
if [ "$(get_gcc_version)" != "5" ]; then
  echo " --- upgrading GCC --- "
  add_toolchain
  ./bin/travis-install-gcc5.sh > /dev/null
else
  echo " --- not upgrading GCC --- "
fi

if [ "$SUITE" = "integration" ]; then
  echo " --- installing integration requirements --- "

  # MongoDB is always installed in integrations.
  echo " --- installing mongodb --- "
  add_toolchain
  ./bin/travis-install-mongo.sh > /dev/null

  echo " --- done installing integration requirements --- "
else
  echo " --- not installing integration requirements --- "
fi

if [ "$SUITE" = "security" ]; then
  echo " --- installing nsp  --- "
  npm install nsp
fi

# Always install time.
sudo apt-get install -qq time
