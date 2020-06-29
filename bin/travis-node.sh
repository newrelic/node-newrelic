#!/bin/bash

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

# https://stackoverflow.com/questions/16989598/bash-comparing-version-numbers/24067243
# tests version strings using `sort`'s -V option
function version_gt() { test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"; }

sudo apt-get update

# so dumb that we need python-software-properties
# to get add-apt-repository
sudo apt-get -y install build-essential libssl-dev curl python-software-properties time sudo

# update gcc to something that will install pg-native module
sudo add-apt-repository -y ppa:ubuntu-toolchain-r/test
sudo apt-get -y update
sudo apt-get -y install gcc-4.9 g++-4.9
sudo rm /usr/bin/g++
sudo rm /usr/bin/gcc
sudo ln -s /usr/bin/g++-4.9 /usr/bin/g++
sudo ln -s /usr/bin/gcc-4.9 /usr/bin/gcc

# Where is ppa:ubuntu-toolchain-r/test?
# sudo add-apt-repository -y ppa:ubuntu-toolchain-r/test
# sudo apt-get -y update
# sudo apt-get -y install libstdc++6-4.7-dev

# only do for NODE 12 AND for old glibc

GLIBC_VERSION_CHECK=`ldd --version | head -n 1 | awk '{print $NF}'`

if [ -z $NR_NODE_VERSION ]; then
    echo "please define NR_NODE_VERSION in local env"
    exit 1
fi

version=$NR_NODE_VERSION
major=${version/.*}
echo $major
if [ $major -gt 11 ] && version_gt 2.17 $GLIBC_VERSION_CHECK;then
  echo "Installing updated glibc\n"
  # can we get this from an actual repository?
  curl -LO 'http://launchpadlibrarian.net/130794928/libc6_2.17-0ubuntu4_amd64.deb'
  sudo dpkg -i libc6_2.17-0ubuntu4_amd64.deb
else
  echo "Skipping glibc update\n"
fi

# install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install $NR_NODE_VERSION
