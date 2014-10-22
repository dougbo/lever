FROM dougbo/crd
MAINTAINER doug orr "doug.orr@gmail.com"

# to execute "docker build -t <buildname>; docker run  -i -a <buildname>"

# ======= ======== ========= ====== ======= ========

# define ENV's for version-specific downloads


# install system components as root
USER root

# ** get some basics **
RUN apt-get update && apt-get install -y -qq --no-install-recommends wget unzip python bzip2 curl

# ** install general utility developer tools **

# get git
RUN apt-get install -y git

# get compile utilities
RUN apt-get install -y make gcc g++
RUN apt-get install -y libx11-dev libxinerama-dev

# we are node-based
RUN curl -sL https://deb.nodesource.com/setup | bash -
RUN apt-get install -y nodejs

# install X11, Qt, nwm support
RUN npm update
RUN npm install -g x11

# use "chrome remote desktop" user to actually run the windows and manager
USER crd
RUN git clone https://github.com/dougbo/lever.git /tmp/lever
RUN cd /tmp/lever; rm -rf build; npm install --production

RUN echo " ">$HOME/.xsession
# RUN echo "node lever/nwm-lever.js &" >>$HOME/.xsession
RUN echo "exec xterm" >>$HOME/.xsession

# FOR DEBUG
# CMD /bin/bash

# the user will be prompted for oauth key and PIN
CMD /opt/google/chrome-remote-desktop/start-host --redirect-url=https://chromoting-auth.googleplex.com/auth --name=lever-`hostname`-`date '+%F-%T'`; tail -f /tmp/chrome_*
