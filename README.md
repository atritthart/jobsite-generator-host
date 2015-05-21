# Zalando Jobsite Docker project

Docker is used for deployment of the static site generator to AWS Beanstalk. You
can also use it for local development, of course.

When updating contents on prismic.io, a webhook triggers a new build of the public
website through the integrated NodeJS application and corresponding gulp tasks.




# First time development environment setup

## Ensure you have Python 3 installed

For example, Mac OS X & Homebrew: `brew install python3`


## Clone this project and pull in submodules

The jobsite-generator-host repository also includes the other three repos as git submodules,
so the first time after cloning you need to init and update them. Example:

    git clone git@github.com:zalando/jobsite-generator-host.git
    git checkout develop
    git submodule init
    git submodule update

This will clone static-site-gen, metalsmith-greenhouse and swig-viewmodel into subdirectories.


## Configure jobsite-generator-host

Copy conf template to a local one:

    cp jobsite-generator.default.yaml jobsite-generator.yaml

Then fill in the "PRISMIC_" secrets. you can retrieve the values from the prismic.io config
pages ("API&Security" and "Webhooks").


## Verify you are able to log into the AWS account

1. Go to http://aws.zalando.net and use your email address
   (firstname.lastname.extern@zalando.de) plus password
2. Change region to Frankfurt (eu-central-1) in the top right corner

If that doesn't work, you might not have the right access or roles in
https://access.zalando.net .

Note: a re-login is needed every two hours.


## Install the required Zalando AWS tools

- Mai: AWS credentials, http://stups.readthedocs.org/en/latest/components/mai.html
- Senza: CloudFormation management, http://stups.readthedocs.org/en/latest/components/senza.html
- Piu: SSH to EC2, http://stups.readthedocs.org/en/latest/components/piu.html

For Senza, you also might want to configure the AWS region in order to avoid
having to give a `--region=eu-central-1` on every run. Edit `~/.aws/config` and
add the region :

    [default]
    region = eu-central-1


## Create a new AWS identity

Log in with your email address (firstname.lastname.extern@zalando.de). The profile name
is arbitrary (local only), but a good guess would be for example "aws-tfox-jobsite" which
will also be used later in this documentation.

    $ mai create aws-tfox-jobsite
    Identity provider URL: aws.zalando.net
    SAML username: eemeli.kantola.extern@zalando.de
    Please enter your SAML password: 
    Authenticating against https://aws.zalando.net.. OK
    Storing new profile in /Users/ekan/Library/Application Support/mai/mai.yaml.. OK


## Create identity and temporary credentials for AWS API and shell access

Create temporary credentials:

    $ mai login aws-tfox-jobsite
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

    cd swig-viewmodel
    git checkout develop
    git pull --rebase
    git rebase qa

    cd metalsmith-greenhouse
    git checkout develop
    git pull --rebase
    git rebase qa

    cd static-site-gen
    git checkout develop
    git pull --rebase
    git rebase qa
    ./node_modules/.bin/gulp deploy -e dev

In http://zalando-tfox-dev.s3-website.eu-central-1.amazonaws.com/build/latest 
check manually:

* Front page
* Job ads list
* One individual job category
* One individual job ad
* Blog post list
* One individual blog post
* One location

After tests pass, merge every changed submodule to QA:

    git checkout qa
    git merge develop
    git push


## Check out and update the superproject if needed

    cd jobsite-generator-host
    git checkout develop

Make sure your Senza YAML configuration is up to date:

    diff jobsite-generator.default.yaml jobsite-generator.yaml

If there are other differences than the S3 credentials, update your config
file accordingly.

Then, commit submodule reference updates in the jobsite-generator-host project
and merge to QA:

    git add static-site-gen metalsmith-greenhouse swig-viewmodel
    git commit
    git rebase qa
    git push origin develop
    git checkout qa
    git merge develop
    git push origin qa


## Ensure you have the most recent Node.js 0.10 base image available

    docker pull node:0.10


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

Then, generate the new image and push it to Pier One:

    cd jobsite-generator-host
    docker build -t pierone.stups.zalan.do/tfox/jobsite-generator:<new-img-version> .
    docker push pierone.stups.zalan.do/tfox/jobsite-generator:<new-img-version>

After a successful execution, you can check out the available versions by accessing
https://pierone.stups.zalan.do/teams/tfox/artifacts/jobsite-generator/tags .


## Delete existing CloudFormation stack

This is needed to ensure there isn't two simultaneous running website generators at a
given time. Otherwise we might run into concurrency problems.

Trying to delete is supposed to be always safe. If there is no existing stack, nothing
happens.

Run `senza delete jobsite-generator.yaml`. Example:

    $ senza delete jobsite-generator.yaml
    Deleting Cloud Formation stack jobsite-generator-41.. OK


## Create the CloudFormation stack with Senza

Run `senza create jobsite-generator.yaml <myapp-version> <dockerimg-version>`, for example:

    $ senza create jobsite-generator.yaml 42 1.3
    Generating Cloud Formation template.. OK
    Creating Cloud Formation stack jobsite-generator-42.. OK

&lt;myapp-version> should be incremented on every deployment. This will create
a CloudFormation stack jobsite-generator-&lt;myapp-version> and use version
&lt;dockerimg-version> Docker image from Pier One.

You can follow the CloudFormation init events either in the web console, or on the command
line by running `senza events test.yaml <myapp-version>`:

    $ senza events jobsite-generator.yaml <myapp-version> --watch=2

If creating fails and gets rolled back, then it might be that your Docker image version
doesn't match one that has been deployed in Pier One. See
https://pierone.stups.zalan.do/teams/tfox/artifacts/jobsite-generator/tags for a current
list.

You can execute 


## Configure the load balancer to listen to plain HTTP in port 80

In AWS console, EC2 => Load Balancers => jobsite-generator-&lt;your-version>
=> Listeners => Edit => Add => HTTP, "Instance Port": 8080 and Save. Prismic
webhook is currently configured to use the HTTP endpoint because we don't have a
generally trusted SSL certificate for the domain.


## Upload tech.jobsite-all.js manually to S3

The build is currently broken regarding JavaScript minification/deployment. As
a consequence, the minified tech.jobsite-all.js needs to be manually uploaded
to tech.workplace.zalan.do/js/tech.zalando-all.js . 


## Check instance health

Run `senza instances` to see the status:

    $ senza instances
    Stack Name       │Ver.│Resource ID│Instance ID│Public IP│Private IP   │State  │LB Status │Launched
    jobsite-generator 42   AppServer   i-7990b7b7            172.31.141.36 RUNNING IN_SERVICE  26m ago 

The jobsite-generator instance's "LB Status" should be IN_SERVICE.

You can also check this in the AWS console: EC2 => jobsite-generator-&lt;your-version>
=> Instances should show one "InService" instance.

http://jobsite-generator.workplace.zalan.do/healthcheck

That's it!




# First time infrastructure setup

This has already been done, but documentation left here as a reference if needed again.


## Initialize the Senza (CloudFormation) configuration

    $ senza --version
    Senza 0.29

    $ senza init jobsite-generator.yaml
    Please select the project template
    1) bgapp: Background app with single EC2 instance
    2) webapp: HTTP app with auto scaling, ELB and DNS
    Please select (1-2): 2
    Application ID [hello-world]: jobsite-generator
    Docker image [stups/hello-world]: tfox/jobsite-generator
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

1. Create a bucket with the name zalando-jobsite-<env> (<env>=dev/qa/prod)
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

3. Under "Static Website Hosting", choose "Enable website hosting" with index document
   index.html


## Prismic.io webhooks setup

https://zalando-jobsite.prismic.io/settings/webhooks/ => introduce a secret,
point to the generator webhook URL (e.g. https://my.domain.name/prismic-hook)
activate the webhook.




# Troubleshooting

## Disabling CloudFormation rollback on failure to enable EC2 host debugging

Use the "--disable-rollback" switch when deploying:

    $ senza create --help
    [...]
      --disable-rollback      Disable Cloud Formation rollback on failure
    [...]

For example:

    $ senza create --disable-rollback jobsite-generator.yaml 42 1.3


## Debugging EC2 with SSH

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

The first place to start looking for errors would be `/var/log/syslog`.


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
     -p 8080:8080 -i -t pierone.stups.zalan.do/tfox/jobsite-generator:<image-version>

Exmaple:

    docker run -e PRISMIC_SECRET=1234 -e PRISMIC_APIURL=https://zalando-jobsite.prismic.io/api \
     -p 8080:8080 -i -t pierone.stups.zalan.do/tfox/jobsite-generator:1.3

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
