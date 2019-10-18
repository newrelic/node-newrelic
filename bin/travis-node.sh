#!/bin/bash

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
ln -s /usr/bin/g++-4.9 /usr/bin/g++
ln -s /usr/bin/gcc-4.9 /usr/bin/gcc

# Where is ppa:ubuntu-toolchain-r/test?
# sudo add-apt-repository -y ppa:ubuntu-toolchain-r/test
# sudo apt-get -y update
# sudo apt-get -y install libstdc++6-4.7-dev

# only do for NODE 12
if [ $NR_NODE_VERSION -gt 11 ]
then
  echo "Insatlling updated glibc\n"
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
