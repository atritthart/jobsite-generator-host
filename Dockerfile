FROM node:0.12

RUN apt-get update
RUN apt-get install -y ruby-full
RUN apt-get install -y default-jre
RUN apt-get install -y python-docutils
RUN gem install scss-lint

RUN mkdir -p /opt/tfox
RUN adduser --home /opt/tfox/static-site-gen/build --no-create-home --disabled-password tfox

ADD metalsmith-greenhouse/package.json /opt/tfox/metalsmith-greenhouse/
ADD metalsmith-greenhouse/lib /opt/tfox/metalsmith-greenhouse/lib
RUN cd /opt/tfox/metalsmith-greenhouse && npm install

ADD swig-viewmodel/index.js swig-viewmodel/package.json /opt/tfox/swig-viewmodel/
ADD swig-viewmodel/lib /opt/tfox/swig-viewmodel/lib
RUN cd /opt/tfox/swig-viewmodel && npm install

RUN install -d -m 777 -o tfox /opt/tfox/static-site-gen/build /opt/tfox/static-site-gen/dist /opt/tfox/static-site-gen/log
ADD static-site-gen/config-*.js static-site-gen/gulpfile.js static-site-gen/package.json static-site-gen/scsslint.yml static-site-gen/server.js /opt/tfox/static-site-gen/
ADD static-site-gen/src /opt/tfox/static-site-gen/src
ADD static-site-gen/_layouts /opt/tfox/static-site-gen/_layouts
ADD static-site-gen/lib /opt/tfox/static-site-gen/lib
RUN cd /opt/tfox/static-site-gen && npm install

EXPOSE 8080

USER tfox
WORKDIR /opt/tfox/static-site-gen
CMD ["node", "server.js"]
