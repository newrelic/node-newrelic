#!/bin/bash

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

# install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install 12
