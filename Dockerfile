FROM node:0.10

RUN apt-get update
RUN apt-get install -y ruby-full
RUN apt-get install -y default-jre
RUN gem install scss-lint

RUN mkdir -p /opt/tfox
WORKDIR /opt/tfox

ADD static-site-gen static-site-gen
ADD metalsmith-greenhouse metalsmith-greenhouse
ADD swig-viewmodel swig-viewmodel
RUN rm -rf static-site-gen/node_modules metalsmith-greenhouse/node_modules swig-viewmodel/node_modules
#RUN cd /opt/tfox/swig-viewmodel && npm install
#RUN cd /opt/tfox/metalsmith-greenhouse && npm install
RUN cd /opt/tfox/static-site-gen && npm install

EXPOSE 8080

# TODO this should not run the development server, but wait for a build trigger
CMD ["node", "server.js"]
