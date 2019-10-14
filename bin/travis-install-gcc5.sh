#! /bin/bash

set -x # echo commands as executed

sudo apt-get install -qq gcc-5 g++-5
sudo update-alternatives \
  --install /usr/bin/gcc gcc /usr/bin/gcc-5 60 \
  --slave /usr/bin/g++ g++ /usr/bin/g++-5
sudo update-alternatives --auto gcc
export CXX="g++-5" CC="gcc-5"

env
# extra fiddling c library stuff for node 12
# which can't run on ubuntu 12.04
apt-get update

# so dumb that we need python-software-properties
# to get add-apt-repository
apt-get -y install build-essential libssl-dev curl python-software-properties

# Where is ppa:ubuntu-toolchain-r/test?
add-apt-repository -y ppa:ubuntu-toolchain-r/test
apt-get -y update
apt-get -y install libstdc++6-4.7-dev

# can we get this from an actual repository?
curl -LO 'http://launchpadlibrarian.net/130794928/libc6_2.17-0ubuntu4_amd64.deb'
dpkg -i libc6_2.17-0ubuntu4_amd64.deb

