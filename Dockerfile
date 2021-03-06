FROM node:0.12

RUN apt-get update
RUN apt-get install -y ruby-full
RUN apt-get install -y default-jre
RUN apt-get install -y python-docutils
RUN apt-get install -y python-markdown
RUN gem install scss-lint

RUN mkdir -p /opt/workplace/server
RUN useradd --home-dir /opt/workplace/static-site-gen/build --no-create-home --uid 999 workplace

ADD server /opt/workplace/server/
RUN cd /opt/workplace/server && npm install

RUN install -d -m 777 -o workplace /opt/workplace/metalsmith-greenhouse
RUN install -d -m 777 -o workplace /opt/workplace/static-site-gen
ADD config-dev.js config-qa.js config-prod.js /opt/workplace/static-site-gen/

USER workplace
RUN cd /opt/workplace/metalsmith-greenhouse && git init && git remote add origin https://github.com/zalando/metalsmith-greenhouse.git
RUN cd /opt/workplace/static-site-gen && git init && git remote add origin https://github.com/zalando/jobsite-static-gen.git

EXPOSE 8080

WORKDIR /opt/workplace/server
CMD ["node", "server.js"]
