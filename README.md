# Zalando Jobsite Docker project

Docker is used for deployment of the static site generator to AWS Beanstalk. You
can also use it for local development, of course.

When updating contents on prismic.io, a webhook triggers a new build of the public
website through the integrated NodeJS application and corresponding gulp tasks.


# First time development environment setup

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


## Create a new AWS identity

Log in with your email address (firstname.lastname.extern@zalando.de).

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




# Creating or updating the Jobsite Generator instance

## Create or update the Docker image to latest version

The images need to be pushed to the Pier One Docker registry that is accessible from
Zalando network: http://stups.readthedocs.org/en/latest/components/pierone.html .

On the first run, clone repo:

	git clone git@code.futurice.com:zalando_tfox/jobsite-generator-host .

Then:

	cd jobsite-generator-host
	git pull
    docker build -t pierone.stups.zalan.do/tfox/jobsite-generator:1.3 .
    docker push pierone.stups.zalan.do/tfox/jobsite-generator:1.3

After a successful execution, you can check out the available versions by accessing
https://pierone.stups.zalan.do/teams/tfox/artifacts/jobsite-generator/tags .


## Delete existing CloudFormation stack

This is needed to ensure there isn't two simultaneous running website generators at a
given time. Otherwise we might run into concurrency problems.

Trying to delete is supposed to be always safe. If there is no existing stack, nothing
happens.

Run "senza delete jobsite-generator.yaml". Example:

    $ senza delete jobsite-generator.yaml
    Deleting Cloud Formation stack jobsite-generator-41.. OK


## Create the CloudFormation stack with Senza

Run "senza create jobsite-generator.yaml <myapp-version> <dockerimg-version>", for example:

    $ senza create jobsite-generator.yaml 42 1.3
    Generating Cloud Formation template.. OK
    Creating Cloud Formation stack jobsite-generator-42.. OK

You can follow the CloudFormation init events either in the web console, or on the command
line by running "senza events test.yaml <myapp-version>":

    $ senza events tfox-jobsite.yaml 42 --watch=2

If creating fails and gets rolled back, then it might be that your Docker image version
doesn't match one that has been deployed in Pier One. See
https://pierone.stups.zalan.do/teams/tfox/artifacts/jobsite-generator/tags for a current
list.

## Check instance health

EC2 => Load Balancers => Instances should show one "InService" instance.




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
2. Set bucket world-readable and jobsite generator writable in Properties => Permissions:
   "Add bucket policy" with content

        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Sid": "PublicReadGetObject",
              "Effect": "Allow",
              "Principal": "*",
              "Action": "s3:GetObject",
              "Resource": "arn:aws:s3:::zalando-jobsite-qa/*"
            },
            {
              "Sid": "JobsiteGeneratorWriteObject",
              "Action": [
                "s3:DeleteObject",
                "s3:PutObject"
              ],
              "Effect": "Allow",
              "Resource": "arn:aws:s3:::zalando-jobsite-qa/*",
              "Principal": {
                "AWS": [
                  "arn:aws:iam::067144859345:role/app-jobsite-generator"
                ]
              }
            }
          ]
        }

3. Under "Static Website Hosting", choose "Enable website hosting" with index document
   index.html




# Debugging with SSH

    piu --even-url https://even.stups.zalan.do --odd-host odd-eu-central-1.workplace.zalan.do \
     --user ekantola 172.31.145.50 "Just testing around"



# Running in development environment

After building the Docker image, run app from docker container:

    docker run -e "PRISMIC_SECRET=<PRISMIC_SECRET>" -e "PRISMIC_APIURL=<PRIMSIC_API_URL>" \
     -p 8080:8080 -i -t zalando/tfox

The environment variables used by the node application need to be passed via
the `-e` parameter of `docker run`. For production AWS, the values are taken from
jobsite-generator.yaml and added in the CloudFormation template, but this is not the case
in a development host.

You can retrieve the secret and the API URL from the prismic.io config pages
("API&Security" and "Webhooks").

If you run docker in Virtualbox (e.g. boot2docker) you may need to forward the port 8080
in VirtualBox, too.
