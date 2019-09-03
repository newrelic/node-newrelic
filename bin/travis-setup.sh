#! /bin/bash


function get_version {
  local num='[[:digit:]][[:digit:]]*' # Grep doesn't have `+` operator.
  local version=`$1 --version 2>/dev/null | grep -o "$num\.$num\.$num" | head -1`
  echo $version | grep -o "$num" | head -1
}

TOOLCHAIN_ADDED="false"
function add_toolchain {
  if [ "$TOOLCHAIN_ADDED" == "false" ]; then
    sudo add-apt-repository ppa:ubuntu-toolchain-r/test -y
    sudo apt-get update -qq
  fi
  TOOLCHAIN_ADDED="true"
}

# npm 5 introduced 'ci' and 6 introduce 'audit', so just default to latest
if (("$(get_version npm)" < "6" )); then
  echo " --- upgrading npm to 6 --- "
  npm install -g npm@6
else
  echo " --- not upgrading npm ($(npm --version)) --- "
fi

if [ "$SUITE" = "versioned" ]; then
  echo " --- installing cassandra --- "
  ./bin/cassandra-setup.sh

  # GCC 5 is the lowest version of GCC we can use.
  if [ "$(get_version gcc)" == "4" ]; then
    echo " --- upgrading GCC --- "
    add_toolchain
    ./bin/travis-install-gcc5.sh > /dev/null
  else
    echo " --- not upgrading GCC ($(gcc --version)) --- "
  fi

  echo " --- installing $SUITE requirements --- "

  # MongoDB is always installed in integrations and versioned.
  echo " --- installing mongodb --- "
  add_toolchain
  ./bin/travis-install-mongo.sh

  echo " --- done installing $SUITE requirements --- "
else
  echo " --- no $SUITE installation requirements --- "
fi


# Always install time.
sudo apt-get install -qq time
