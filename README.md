# Zalando Jobsite Docker project

Docker is used for deployment of the static site generator to AWS Beanstalk. You
can also use it for local development, of course.

When updating contents on prismic.io, a webhook triggers a new build of the public
website through the integrated NodeJS application and corresponding gulp tasks.




# First time development environment setup

## Ensure you have Python 3 installed

For example, Mac OS X & Homebrew: `brew install python3`


## Clone projects

    git clone git@github.com:zalando/jobsite-generator-host.git
    git clone git@github.com:zalando/jobsite-static-gen.git
    git clone git@github.com:zalando/metalsmith-greenhouse.git

Configure server:

    cp jobsite-static-gen/config.default.js jobsite-generator-host/config-dev.js
    cp jobsite-static-gen/config.default.js jobsite-generator-host/config-qa.js
    cp jobsite-static-gen/config.default.js jobsite-generator-host/config-prod.js

Then fill in relevant values.

For deploying locally to dev, you may want to:

    ln -s ../jobsite-generator-host/config-dev.js jobsite-static-gen/


## Configure jobsite-generator-host

Copy conf template to a local ones:

    cp jobsite-generator.default.yaml jobsite-generator-qa.yaml
    cp jobsite-generator.default.yaml jobsite-generator-prod.yaml

Then fill in the "TODO" values. You can retrieve Prismic secrets from the
prismic.io config pages ("API&Security" => "Webhooks").


## Verify you are able to log into the AWS account

1. Go to http://aws.zalando.net and use your email address
   (firstname.lastname.extern@zalando.de) plus password
2. Change region to Frankfurt (eu-central-1) in the top right corner

If that doesn't work, you might not have the right access or roles in
https://access.zalando.net .

Note: a re-login is needed every two hours.


## Install and configure the required Zalando AWS tools

Stups metapackage (https://pypi.python.org/pypi/stups) includes everything that
is needed:

    sudo pip3 install --upgrade stups

For PierOne Docker registry, do a first-time login and configure:

    $ pierone login
    Please enter the Pier One URL: https://pierone.stups.zalan.do 
    Getting OAuth2 token "pierone"..
    Please enter the OAuth access token service URL: https://token.auth.zalando.com/access_token
    Password:

The configuration is stored under "~/Library/Application Support/pierone" for
later (on OSX).

For Senza, you also might want to configure the AWS region in order to avoid
having to give a `--region=eu-central-1` on every run. Edit `~/.aws/config` and
add the region :

    [default]
    region = eu-central-1


## Create a new AWS identity

Log in with your email address (firstname.lastname.extern@zalando.de). The profile name
is arbitrary (local only), but a good guess would be for example "aws-jobsite" which
will also be used later in this documentation.

    $ mai create aws-jobsite
    Identity provider URL: aws.zalando.net
    SAML username: eemeli.kantola.extern@zalando.de
    Please enter your SAML password:
    Authenticating against https://aws.zalando.net.. OK
    Storing new profile in /Users/ekan/Library/Application Support/mai/mai.yaml.. OK


## Create identity and temporary credentials for AWS API and shell access

Create temporary credentials:

    $ mai login aws-jobsite
    Authenticating against https://aws.zalando.net.. OK
    Assuming role AWS Account 067144859345 (None): Shibboleth-PowerUser.. OK
    Writing temporary AWS credentials.. OK


## Upload SSH public key in ZACK

This is needed for Piu SSH access to EC2 instances.

1. Go to https://access.zalando.net
2. Choose Settings in top right corner (gear icon)
3. In Certificates box, click the green "key plus" icon in top right corner
4. Ensure "SSH Key" is selected as the certificate type, then select your SSH public
   key file and click "Request Certifcate"
5. Wait for someone to approve the request. After that, you should be able to SSH
   into your EC2 instances.




# Creating or updating the Jobsite Generator instance

## Verfify that everything works

Deploy to dev first to test:

    cd metalsmith-greenhouse
    git checkout develop
    git pull --rebase
    git merge qa

    cd static-site-gen
    git checkout develop
    git pull --rebase
    git merge qa
    ./node_modules/.bin/gulp deploy -e dev

Note: rst2html does not necessarily produce same output or even work well
with a local build, so for RST blog posts, you need to test build from the real
Docker container.

In http://zalando-tfox-dev.s3-website.eu-central-1.amazonaws.com/build/latest
check manually:

* Front page
* Job ads list
* One individual job category
* One individual job ad
* Blog post list
* One individual new-style blog post
* One individual RST-source blog post
* One individual MD-source blog post
* One location
* Relocation page

After tests pass, merge every changed submodule to QA:

    git checkout develop
    git pull --rebase
    git checkout qa
    git pull --rebase
    git merge develop
    git push origin qa


## Check out and update the generator host if needed

    cd jobsite-generator-host
    git checkout develop

Make sure your Senza YAML configuration is up to date:

    diff jobsite-generator.default.yaml jobsite-generator-qa.yaml
    diff jobsite-generator.default.yaml jobsite-generator-prod.yaml

If there are other differences than the Prismic API credentials (SECRET, APIURL)
and environment, update your config files accordingly.

Then, commit submodule reference updates in the jobsite-generator-host project
and merge to QA:

    git merge qa
    git push origin develop
    git checkout qa
    git merge develop
    git push origin qa


## Ensure you have the most recent Node.js 0.12 base image available

    docker pull node:0.12


## Create or update the Docker image to latest version

The images need to be pushed to the Pier One Docker registry that is accessible from
Zalando network, http://stups.readthedocs.org/en/latest/components/pierone.html
(UI in https://pierone.stups.zalan.do/ui/). The new image version should be
greater than the current latest one. You can find out the running container's
image version by running `senza list` and checking the ImageVersion in
Description:

    $ senza list
    Stack Name       │Ver.│Status         │Created│Description
    jobsite-generator 13   CREATE_COMPLETE  1h ago Jobsite Generator (ImageVersion: 1.0.0)

Alternatively, go to AWS console and CloudFormation.

Then, generate the new image:

    cd jobsite-generator-host
    docker build -t pierone.stups.zalan.do/workplace/jobsite-generator:<new-img-version> .

Test it by deploying to dev env:

    docker run -i -t -e JOBSITE_GENERATOR_DEBUG=1 -e TFOX_ENV=dev \
     pierone.stups.zalan.do/workplace/jobsite-generator:<img-version>

Since Git cloning takes some time, it might make sense to commit the container
into an image that can be reused or investigated later if need be:

    docker ps -a
    # Copy the latest container id
    docker commit <latest-container-id> jobsite-generator-test:<img-version>

Normally, most of the file uploads to S3 should be getting skipped, in case
you deployed properly from your development host. Some differences might arise
in the rst2html version differences, though, so expect to have the old
blog posts from RST source to get updated. (TODO How to fix version mismatch?)
Test the affected pages once more manually after deploy.

After everything works, push the image to Pier One:

    pierone login -U <shortusername>
    docker push pierone.stups.zalan.do/workplace/jobsite-generator:<new-img-version>

After a successful execution, check out the available versions by:

    pierone tags workplace

Finally, create a git tag, reflecting the new docker image version:

    git tag docker-image-<new-img-tag>
    git push --tags


## Disable existing CloudFormation stack

This is needed to ensure there isn't two simultaneous running website generators at a
given time. Otherwise we might run into concurrency problems.

1. In AWS console, go to EC2 => "Auto Scaling Groups" and choose the group
   corresponding to the existing CloudFormation stack. Then Details tab => Edit
   and set "Health Check Type" to "EC2". This prevents the EC2 instance from
   being recycled when healthcheck starts failing after deliberately disabling
   it.

2. SSH into the corresponding EC2 node. See "Debugging EC2 with SSH" below about
   how to get access.

3. Just in case, verify there's nothing interesting in the logs by examining
   `/var/log/syslog`:

        grep -ev '(berry: INFO|dhclient|CRON)' /var/log/syslog |less

4. Pause the docker container by `docker pause` after determining its container
   id. Example:

        $ docker ps
        CONTAINER ID        IMAGE                                                      ...
        fe1a56f9ea54        pierone.stups.zalan.do/workplace/jobsite-generator:2.0.1   ...
        $ docker pause fe1a56f9ea54

If new stack deployment can't be done for a reason or another as per the
following instructions, then you still have the possibility to unpause the
old container (see "Rolling back an old CloudFormation stack" below).


## Create a new CloudFormation stack with Senza

Run `senza create jobsite-generator-<env>.yaml <stack-version> <docker-version>`,
for example:

    $ senza create jobsite-generator-qa.yaml 42 1.3
    Generating Cloud Formation template.. OK
    Creating Cloud Formation stack jobsite-generator-qa-42.. OK

&lt;stack-version> should be incremented on every deployment. This will create
a CloudFormation stack jobsite-generator-&lt;stack-version> and use version
&lt;dockerimg-version> Docker image from Pier One.

You can follow the CloudFormation init events either in the AWS web console, or
on the command line by running `senza events test.yaml <stack-version>`:

    $ senza events jobsite-generator-<env>.yaml <stack-version> --watch=2

If creating fails and gets rolled back, then it might be that your Docker
image version doesn't match one that has been deployed to Pier One. See
https://pierone.stups.zalan.do/teams/workplace/artifacts/jobsite-generator/tags
for a current list.


## Configure the load balancer to listen to plain HTTP in port 80

In AWS console, EC2 => Load Balancers => jobsite-generator-&lt;your-version>
=> Listeners => Edit => Add => HTTP, "Instance Port": 8080 and Save. Prismic
webhook is currently configured to use the HTTP endpoint because we don't have a
generally trusted SSL certificate for the domain.


## Check instance health after 5-10 minutes

Run `senza instances` to see the status:

    $ senza instances
    Stack Name       │Ver.│Resource ID│Instance ID│Public IP│Private IP   │State  │LB Status │Launched
    jobsite-generator 42   AppServer   i-7990b7b7            172.31.141.36 RUNNING IN_SERVICE  26m ago

The jobsite-generator instance's "LB Status" should be IN_SERVICE.

You can also check this in the AWS console: EC2 => Load Balancers =>
jobsite-generator-&lt;your-version> => Instances should show one "InService" instance.

http://jobsite-generator.workplace.zalan.do/healthcheck


## Wait for the new jobsite to be generated

When the Docker container is started, the initial code update followed by a
deploy take place. This should be complete around half an hour after starting
the CloudFormation stack creation.


## Delete old CloudFormation stack

Do this from the AWS web console, or from command line by running
`senza delete jobsite-generator.yaml <old-stack-version>`. Example:

    $ senza delete jobsite-generator.yaml 41
    Deleting Cloud Formation stack jobsite-generator-41.. OK

That's it!


## Rolling back an old CloudFormation stack

1. To avoid concurrency problems, first make sure no other jobsite-generator
   CloudFormation stacks are up and running. If there are, delete stack, or at
   if you need to debug later, disable for now (see
   "Disable existing CloudFormation stack" above).

2. Ensure Route53 domain points to the old stack's load balancer.

3. Unpause the old Docker container with `docker unpause`.

4. Switch the old stack's Auto Scaling Group healthcheck type back to "ELB".

5. Test healthcheck and jobsite generation by triggering with Prismic webhook.




# First time infrastructure setup

This has already been done, but documentation left here as a reference if needed again.


## Initialize the Senza (CloudFormation) configuration

    $ senza --version
    Senza 0.29

    $ senza init jobsite-generator.default.yaml
    Please select the project template
    1) bgapp: Background app with single EC2 instance
    2) webapp: HTTP app with auto scaling, ELB and DNS
    Please select (1-2): 2
    Application ID [hello-world]: jobsite-generator
    Docker image [stups/hello-world]: workplace/jobsite-generator
    HTTP port [8080]:
    HTTP health check path [/]:
    EC2 instance type [t2.micro]:
    Checking security group app-hello-world.. OK
    Security group app-hello-world does not exist. Do you want Senza to create it now? [Y/n]:
    Checking security group app-hello-world-lb.. OK
    Security group app-hello-world-lb does not exist. Do you want Senza to create it now? [Y/n]:
    Creating IAM role app-hello-world.. OK
    Generating Senza definition file test.yaml.. OK



## S3 bucket setup

1. Create a bucket with the name zalando-jobsite-&lt;env> (&lt;env>=dev/qa/prod)

2. Set bucket world-readable Properties => Permissions: "Add bucket policy" with content

        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Sid": "PublicReadGetObject",
              "Effect": "Allow",
              "Principal": "*",
              "Action": "s3:GetObject",
              "Resource": "arn:aws:s3:::tech.workplace.zalan.do/*"
            }
          ]
        }

3. Under "Static Website Hosting", choose "Enable website hosting" with Index Document
   `index.html` and Error Document `404.html`.


## Prismic.io webhooks setup

https://zalando-jobsite.prismic.io/settings/webhooks/ => introduce a secret,
point to the generator webhook URL (e.g. https://my.domain.name/prismic-hook)
activate the webhook.


## Github webhooks setup

https://github.com/zalando/jobsite-static-gen/settings/hooks and there, add
hooks for QA and PROD payload URLs with default settings:

* http://jobsite-generator-qa.workplace.zalan.do/github-hook
* http://jobsite-generator.workplace.zalan.do/github-hook

Whenever a branch (qa or master) is updated, a code update followed by a deploy
is triggered in jobsite generator.




# Troubleshooting

## Disabling CloudFormation rollback on failure to enable EC2 host debugging

Use the "--disable-rollback" switch when deploying:

    $ senza create --help
    [...]
      --disable-rollback      Disable Cloud Formation rollback on failure
    [...]

For example:

    $ senza create --disable-rollback jobsite-generator.yaml 42 1.3 qa


## Debugging EC2 with SSH

Figure out the EC2 instance's IP address with `senza instances`:

    $ senza instances
    Stack Name       │Ver.│Resource ID│Instance ID│Public IP│Private IP   │State  │LB Status │Launched
    jobsite-generator 15   AppServer   i-0d41facc            <internal-ip> RUNNING IN_SERVICE  10d ago


Then run:

    piu --even-url https://even.stups.zalan.do --odd-host odd-eu-central-1.workplace.zalan.do \
      --user <username> <internal-ip> <comment>

Example:

    $ piu --even-url https://even.stups.zalan.do --odd-host odd-eu-central-1.workplace.zalan.do \
      --user ekantola 172.31.145.144 "Just testing around"
    Password:
    Requesting access to host 172.31.145.144 via odd-eu-central-1.workplace.zalan.do for ekantola..
    Access to host odd-eu-central-1.workplace.zalan.do/52.28.48.168 for user ekantola was granted.
    You can now access your server with the following command:
    ssh -tA ekantola@odd-eu-central-1.workplace.zalan.do ssh ekantola@172.31.145.144

We need a running ssh-agent with the identity file matching to the one you uploaded in ZACK:

    $ ssh-add
    Identity added: /Users/ekan/.ssh/id_rsa (/Users/ekan/.ssh/id_rsa)

Now logging in with the ssh cmdline output by Piu should work:

    $ ssh -tA ekantola@odd-eu-central-1.workplace.zalan.do ssh ekantola@172.31.145.144

The first place to start looking for log messages would be `/var/log/syslog`
since the Zalando AWS Docker setup is configured to output everything from
containers to there (option ``).


## Zalando STUPS hints

See http://stups.readthedocs.org/en/latest/user-guide/troubleshooting.html




# Development environment

## Running the static-site-gen server

Setting up environment:

    export PRISMIC_SECRET=1234
    export PRISMIC_APIURL=https://zalando-jobsite.prismic.io/api

    $ cd static-site-gen
    $ server.js
    Server listening at http://0.0.0.0:8080

Debug mode, to output requests on console:

    $ JOBSITE_GENERATOR_DEBUG=1 node server.js
    Debug logging enabled
    Server listening at http://0.0.0.0:8080


## Running the Docker container

After building the Docker image, run app from docker container:

    docker run -e "PRISMIC_SECRET=<PRISMIC_SECRET>" -e "PRISMIC_APIURL=<PRIMSIC_API_URL>" \
     -p 8080:8080 -i -t pierone.stups.zalan.do/workplace/jobsite-generator:<image-version>

Exmaple:

    docker run -e PRISMIC_SECRET=1234 -e PRISMIC_APIURL=https://zalando-jobsite.prismic.io/api \
     -p 8080:8080 -i -t pierone.stups.zalan.do/workplace/jobsite-generator:1.3

The environment variables used by the node application need to be passed via
the `-e` parameter of `docker run`. For production AWS, the values are taken from
jobsite-generator.yaml and added in the CloudFormation template, but this is not the case
in a development host.

You can retrieve the secret and the API URL from the prismic.io config pages
("API&Security" and "Webhooks").

If you run docker in VirtualBox (e.g. boot2docker) you may need to forward the port 8080
in VirtualBox, too.


## Testing webhooks manually

Provided you have the server running locally, simulating a webhook trigger with curl:

    curl -H 'Content-Type: application/json' -v http://127.0.0.1:8080/prismic-hook \
     --data '{"secret":"1234","apiUrl":"https://zalando-jobsite.prismic.io/api","type":"api-update"}'


## AWS Beanstalk deployment for testing elsewhere

Deployment can be handled with AWS Beanstalk CLI tools
([Setup Instructions](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-getting-set-up.html)).

To deploy the currently checked out directory with the CLI tools, run: `eb deploy`

The hosting environment needs to specify the following environment variables
to deploy to S3: S3REGION, S3BUCKET, PRISMIC_SECRET, PRISMIC_APIURL.

Optionally also: S3KEY, S3SECRET unless you have configured the EB EC2 role to have sufficient
write access to EC2.

The port forwarding for the AWS Beanstalk load balancer is defined in `Dockerrun.aws.json`
