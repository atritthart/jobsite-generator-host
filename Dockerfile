FROM node:0.12

RUN apt-get update
RUN apt-get install -y ruby-full
RUN apt-get install -y default-jre
RUN apt-get install -y python-docutils
RUN gem install scss-lint

RUN mkdir -p /opt/tfox
RUN useradd --home-dir /opt/tfox/static-site-gen/build --no-create-home --uid 999 tfox

ADD metalsmith-greenhouse /opt/tfox/metalsmith-greenhouse/
RUN cd /opt/tfox/metalsmith-greenhouse && npm install

RUN install -d -m 777 -o tfox /opt/tfox/static-site-gen/build /opt/tfox/static-site-gen/dist /opt/tfox/static-site-gen/log

ADD static-site-gen /opt/tfox/static-site-gen/
RUN cd /opt/tfox/static-site-gen/lib/swig-viewmodel && npm install
RUN cd /opt/tfox/static-site-gen/lib/metalsmith-prismic && npm install
RUN cd /opt/tfox/static-site-gen && npm install

EXPOSE 8080

USER tfox
WORKDIR /opt/tfox/static-site-gen
CMD ["node", "server.js"]
