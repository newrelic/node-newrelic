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
  # from https://github.com/travis-ci/travis-ci/issues/9512#issuecomment-382235301
  sudo add-apt-repository -y ppa:webupd8team/java
  sudo apt-get update

  sudo apt-get install -y oracle-java8-installer || true

  # todo remove this kludge and the above || true when the ppa is fixed
  pushd /var/lib/dpkg/info
  sudo sed -i 's|JAVA_VERSION=8u161|JAVA_VERSION=8u172|' oracle-java8-installer.*
  sudo sed -i 's|PARTNER_URL=http://download.oracle.com/otn-pub/java/jdk/8u161-b12/2f38c3b165be4555a1fa6e98c45e0808/|PARTNER_URL=http://download.oracle.com/otn-pub/java/jdk/8u172-b11/a58eab1ec242421181065cdc37240b08/|' oracle-java8-installer.*
  sudo sed -i 's|SHA256SUM_TGZ="6dbc56a0e3310b69e91bb64db63a485bd7b6a8083f08e48047276380a0e2021e"|SHA256SUM_TGZ="28a00b9400b6913563553e09e8024c286b506d8523334c93ddec6c9ec7e9d346"|' oracle-java8-installer.*
  sudo sed -i 's|J_DIR=jdk1.8.0_161|J_DIR=jdk1.8.0_172|' oracle-java8-installer.*
  popd
  sudo apt-get update

  sudo apt-get install -y oracle-java8-installer

  echo " --- installing cassandra --- "

  ./bin/setup-cassandra.sh

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
