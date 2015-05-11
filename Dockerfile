FROM node:0.10

RUN apt-get update
RUN apt-get install -y ruby-full
RUN apt-get install -y default-jre
RUN gem install scss-lint

RUN mkdir -p /opt/tfox

ADD static-site-gen /opt/tfox/static-site-gen
ADD metalsmith-greenhouse /opt/tfox/metalsmith-greenhouse
ADD swig-viewmodel /opt/tfox/swig-viewmodel
RUN rm -rf /opt/tfox/static-site-gen/node_modules /opt/tfox/metalsmith-greenhouse/node_modules /opt/tfox/swig-viewmodel/node_modules
RUN cd /opt/tfox/swig-viewmodel && npm install
RUN cd /opt/tfox/metalsmith-greenhouse && npm install
RUN cd /opt/tfox/static-site-gen && npm install

EXPOSE 8080

WORKDIR /opt/tfox/static-site-gen
CMD ["node", "server.js"]
