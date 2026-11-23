from lib import *

blocks = [
    P('''"The cloud" is other people's computers, rented by the minute through an API. That sentence is glib but useful: everything in
    the last three chapters still applies. Cloud servers are Linux machines running services behind reverse proxies, managed through
    REST APIs, protected with TLS and signed requests. What changes is that the network, the disks, the firewalls and even the
    permissions are now software you configure, mostly with JSON, and mistakes are one API call away from the whole internet. This chapter
    uses AWS names because they are the most common, and gives the Azure and Google Cloud equivalents. You do not need an account to do
    the labs: the VPC and IAM simulators, the Python and the container work all run on your Mac or in this page.'''),

    H2('What you are actually renting', 'models'),
    P('''NIST's definition (SP 800-145) names five characteristics: on-demand self-service, broad network access, resource pooling,
    rapid elasticity and measured service. In plain words: you get resources through an API in seconds, from anywhere, sharing hardware
    with other customers, scaling up and down, and paying for what you use. Services come in layers, and the higher you go the less you
    manage and the less you control:'''),
    TABLE(['Model', 'You manage', 'Provider manages', 'Examples'], [
        ['On-premises (your homelab)', 'everything, down to power and disks', 'nothing', 'your Raspberry Pi, a NAS, a rack'],
        ['**IaaS**: infrastructure', 'OS, patches, runtime, app, data', 'hardware, network, virtualisation', 'EC2, Azure Virtual Machines, Compute Engine, a VPS'],
        ['**CaaS**: containers', 'container images, app, data', 'plus the OS and orchestration', 'ECS/Fargate, Cloud Run, Azure Container Apps'],
        ['**PaaS**: platform', 'app code and data', 'plus runtime, scaling, deploys', 'Elastic Beanstalk, App Service, App Engine, Heroku, Fly.io'],
        ['**FaaS**: functions', 'single functions and data', 'plus servers entirely; billed per call', 'Lambda, Azure Functions, Cloud Run functions'],
        ['**SaaS**: software', 'your settings and data', 'the whole application', 'Gmail, GitHub, Microsoft 365'],
    ], 'Service models'),
    ASCII('''
                    ⟪w:SHARED RESPONSIBILITY⟫ (IaaS shown; it shifts left as you move up to PaaS and SaaS)

      ⟪y:YOU⟫  data  ·  who can access it (IAM)  ·  application  ·  OS patches  ·  firewall rules  ·  encryption settings
      ─────────────────────────────────────────────────────────────────────────────────────────────────────────
      ⟪c:PROVIDER⟫  physical security  ·  hardware  ·  hypervisor  ·  the network between data centres  ·  the API itself
    '''),
    P('''Most cloud breaches happen on the *you* side of that line: a storage bucket left public, a key committed to GitHub, a security
    group open to the world, an unpatched VM. The provider's side rarely fails. That is why this chapter spends as long on networks and
    permissions as on servers.'''),

    H2('Regions, zones and latency', 'regions'),
    P('''A **region** is a geographic area such as `us-east-1` (northern Virginia) or `eu-west-2` (London). Each region has several
    **availability zones** (AZs): separate data centres with their own power and cooling, a few milliseconds apart. Spread a service across
    two or more AZs and one building can fail without taking you down. Pick a region by where your users are, which laws apply to the data,
    which services exist there and the price, which differs between regions.'''),
    RUN('''
    # Light in fibre covers about 200 km per millisecond, and real paths are longer than straight lines.
    ROUTES = {"London to Dublin": 460, "London to Frankfurt": 640, "London to N. Virginia": 5900, "London to Sydney": 17000}
    for route, km in ROUTES.items():
        best_rtt = 2 * km / 200                      # there and back, at the speed of light in glass
        print(f"{route:<24} {km:>6} km   round trip at least {best_rtt:5.1f} ms")
    print("A page that needs 10 sequential requests to Sydney waits at least", round(10 * 2 * 17000 / 200), "ms")
    '''),
    P('''No amount of money removes that floor. It is why CDNs cache content near users, why chatty APIs feel slow across oceans, and why
    the database should sit in the same region (ideally the same AZ) as the code that queries it.'''),

    H2('Compute: VMs, containers and functions', 'compute'),
    P('''A **virtual machine** (EC2 instance, Azure VM, Compute Engine instance) is the closest thing to your own server: you pick an image
    (Ubuntu, Debian, Amazon Linux), a size (CPUs and memory), a disk and a network, and you get SSH access. Everything from the Server Basics
    chapter applies unchanged. A **container** packages an application with its dependencies so it runs the same on your Mac and in the cloud.
    A **function** is a single handler that the platform runs on demand.'''),
    H3('Containers', 'containers'),
    P('''A container image is a stack of read-only filesystem layers plus metadata (which command to run, which port it listens on). A
    container is a running process from that image, isolated with Linux namespaces and limited with cgroups. It is not a VM: it shares the
    host's kernel, starts in milliseconds and adds almost no overhead. On a Mac, containers run inside a small Linux VM that Docker Desktop,
    OrbStack or colima manages for you. Here is a `Dockerfile` for the API from Server Basics:'''),
    FILE('Dockerfile', '''
    # Small official Python base image
    FROM python:3.13-slim

    # Don't run as root inside the container
    RUN useradd --create-home app
    WORKDIR /app
    COPY api_server.py .
    USER app

    # The server must listen on all interfaces inside the container,
    # so change its bind address from 127.0.0.1 to 0.0.0.0 (or read it from an env var).
    ENV HOST=0.0.0.0 PORT=8080
    EXPOSE 8080
    HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2)" || exit 1
    CMD ["python", "api_server.py"]
    '''),
    SH('''
    docker build -t labapi:1.0 .
    docker run -d --name labapi -p 127.0.0.1:8080:8080 labapi:1.0
    docker ps
    curl -s http://127.0.0.1:8080/health
    docker logs -f labapi
    docker stop labapi && docker rm labapi
    '''),
    ANAT('Publishing a container port', [
        ('docker run', 'create and start a container'),
        ('-d', 'detached: run in the background and print the container ID'),
        ('--name labapi', 'a name to use instead of the ID in later commands'),
        ('-p 127.0.0.1:8080:8080', 'host address : host port : container port. Without the address, Docker publishes on every interface'),
        ('labapi:1.0', 'image name and tag: never deploy `latest`, you cannot tell what it was'),
    ]),
    CALLOUT('gotcha', 'Inside a container, 127.0.0.1 is the container', '''`api_server.py` binds to `127.0.0.1`, which inside the container means "only programs in this container". Docker forwards
    published ports to the container's network interface, so the server must bind to `0.0.0.0`. Change the two lines in `__main__` to read
    `os.environ.get("HOST", "127.0.0.1")` and `int(os.environ.get("PORT", 8080))`. This is the most common "works locally, not in Docker"
    problem.'''),
    CMD('docker', 'srv-ctr', 'docker', 'Build container images and run, inspect, log and stop containers.',
        'docker build -t NAME:TAG DIR        docker run [OPTIONS] IMAGE [CMD]        docker ps | logs | exec | stop | rm',
        ['`docker` is a client for a daemon that builds images and runs containers. `build` reads a `Dockerfile` and produces an image, caching each instruction as a layer so unchanged steps are instant next time (order instructions from least to most frequently changing). `run` creates a container from an image; `exec` runs another command inside a running one.',
         'Images are referenced as `registry/name:tag`. Cloud platforms pull images from a registry such as Docker Hub, GitHub Container Registry, Amazon ECR or Google Artifact Registry, so deploying usually means `docker push` followed by telling the platform the new tag.',
         'On macOS, Docker Desktop, OrbStack and colima all provide the `docker` command and a Linux VM to run it in. Check the licence terms of Docker Desktop for work use.'],
        flags=[('-t NAME:TAG', 'name the image you build'), ('-d', 'run detached'), ('-p HOSTIP:HOST:CONTAINER', 'publish a port'), ('-e KEY=VALUE', 'set an environment variable'),
               ('-v HOSTDIR:CONTAINERDIR', 'mount a directory'), ('--rm', 'delete the container when it exits'), ('exec -it NAME sh', 'open a shell in a running container')],
        examples=[('ex', 'Build and run the lab API, reachable from this Mac only', 'docker build -t labapi:1.0 . && docker run -d --rm --name labapi -p 127.0.0.1:8080:8080 labapi:1.0'),
                  ('ex', 'Look inside a running container', 'docker exec -it labapi sh'),
                  ('pipe', 'Show the size of every local image, largest first', "docker images --format '{{.Size}}\\t{{.Repository}}:{{.Tag}}' | sort -hr")],
        gotchas=['Secrets passed with `-e` or written in a `Dockerfile` end up in `docker inspect` output or in image layers. Use your platform\'s secret store.',
                 'On Linux hosts, published ports bypass `ufw` rules (see Server Basics). Publish to `127.0.0.1` when a reverse proxy sits in front.'],
        see=['systemctl', 'curl'], tags=['containers']),
    H3('Functions', 'functions'),
    P('''With **FaaS** you upload a handler, and the platform runs it when an event arrives: an HTTP request, a file landing in storage,
    a message on a queue, a timer. You pay per invocation and per millisecond, and nothing runs (or costs) when there are no events. The
    catch is the **cold start**: the first call after a quiet period waits while the platform starts a fresh environment. An AWS Lambda
    handler in Python is just a function, so you can call it locally with a sample event exactly as the platform would:'''),
    RUN('''
    import json

    def handler(event, context):
        """Lambda behind an HTTP API: event is the request, the return value is the response."""
        params = event.get("queryStringParameters") or {}
        name = params.get("name", "world")
        if len(name) > 40:
            return {"statusCode": 400, "body": json.dumps({"error": "name too long"})}
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": f"hello, {name}", "path": event["rawPath"]}),
        }

    event = {"rawPath": "/hello", "queryStringParameters": {"name": "lab"},
             "requestContext": {"http": {"method": "GET"}}}
    print(handler(event, context=None))
    print(handler({"rawPath": "/hello", "queryStringParameters": None}, None)["body"])
    print(handler({"rawPath": "/hello", "queryStringParameters": {"name": "x" * 50}}, None)["statusCode"])
    '''),
    P('''Same idea as the WSGI app in Server Basics: keep the logic in a plain function, and the platform becomes a detail you can test
    without. Functions suit spiky or occasional work (webhooks, thumbnails, scheduled jobs). Long-running, steady or latency-critical
    services are usually cheaper and simpler as containers or VMs.'''),

    H2('Storage: block, file and object', 'storage'),
    TABLE(['Kind', 'Looks like', 'Typical use', 'AWS', 'Azure', 'Google Cloud'], [
        ['Block', 'a raw disk attached to one VM', 'the OS disk, a database\'s data files', 'EBS', 'Managed Disks', 'Persistent Disk'],
        ['File', 'a network share (NFS or SMB)', 'files shared by several servers', 'EFS, FSx', 'Azure Files', 'Filestore'],
        ['Object', 'a key-value store of whole files over HTTPS', 'backups, media, logs, static sites, data lakes', 'S3', 'Blob Storage', 'Cloud Storage'],
    ]),
    P('''**Object storage** is the cloud's most important invention. A **bucket** holds objects addressed by a **key** such as
    `reports/2026/q3.csv`: the slashes are just characters, not real folders. You read and write whole objects through a REST API (`PUT`
    and `GET`), it scales to any size, and S3 is designed for 99.999999999% (eleven nines) durability by storing copies across several AZs.
    Objects are private by default; since April 2023, new S3 buckets block public access unless you deliberately turn that off.'''),
    P('''To give someone temporary access to one private object without making it public or sharing your keys, generate a **presigned
    URL**: a link whose query string carries an expiry time and an HMAC signature made with your credentials (the same idea as the webhook
    signatures in the APIs chapter). Anyone with the link can download that object until it expires, and nothing else.'''),
    SH('''
    aws s3 mb s3://lab-reports-$RANDOM
    aws s3 cp report.csv s3://lab-reports-12345/2026/q3.csv
    aws s3 ls s3://lab-reports-12345 --recursive --human-readable
    aws s3 presign s3://lab-reports-12345/2026/q3.csv --expires-in 3600
    aws s3 sync ./site s3://lab-reports-12345/site --delete
    '''),
    CMD('aws', 'srv-cloud', 'brew:awscli', 'The AWS command-line interface: every AWS API, as subcommands, from your terminal.',
        'aws SERVICE COMMAND [--options] [--profile NAME] [--region REGION] [--output json|table|text]',
        ['`aws` turns each AWS API call into a command: `aws ec2 describe-instances` is the `DescribeInstances` API. It signs every request with your credentials using SigV4 (an HMAC-based scheme), sends it over HTTPS, and prints the JSON response. `--query` filters the output with JMESPath, so you rarely need `jq`.',
         'Credentials come from `aws configure sso` (single sign-on, preferred), environment variables, or `~/.aws/credentials`. `--profile` picks a named set. Long-lived access keys on a laptop are the classic way accounts get compromised: prefer SSO with short-lived credentials.',
         'Azure has `az` and Google Cloud has `gcloud`; they follow the same pattern of service, verb and JSON output.'],
        flags=[('--profile NAME', 'use a named credential profile'), ('--region REGION', 'override the default region'), ('--query EXPR', 'JMESPath filter on the JSON output'),
               ('--output table', 'readable tables instead of JSON'), ('sts get-caller-identity', 'print which account and identity you are using: run it first, every time')],
        examples=[('ex', 'Who am I, and in which account?', 'aws sts get-caller-identity'),
                  ('ex', 'Running instances as a table', "aws ec2 describe-instances --filters Name=instance-state-name,Values=running --query 'Reservations[].Instances[].[InstanceId,InstanceType,PublicIpAddress]' --output table"),
                  ('pipe', 'Find security group rules open to the whole internet', "aws ec2 describe-security-groups --query 'SecurityGroups[].IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`]].[FromPort]' --output text | sort -nu")],
        gotchas=['Commands act on whatever account and region your profile points at. A habit of `aws sts get-caller-identity` before anything destructive prevents the worst mistakes.'],
        see=['curl', 'jq'], tags=['cloud']),

    H2('Networking: VPCs, subnets and security groups', 'vpc'),
    P('''A **VPC** (virtual private cloud; a VNet in Azure) is your own private network in a region, with an address range you choose from
    the private blocks you met in the addressing chapter. You divide it into **subnets**, each in one availability zone. What makes a subnet
    "public" or "private" is not a setting on the subnet but its **route table**:'''),
    TABLE(['Piece', 'What it does', 'Lives where'], [
        ['Route table', 'decides where packets for each destination go; every table has a `local` route for the VPC range', 'attached to subnets'],
        ['Internet gateway (IGW)', 'connects the VPC to the internet and translates public IPs', 'the VPC edge'],
        ['Public subnet', 'its route table sends `0.0.0.0/0` to the IGW', 'one AZ'],
        ['NAT gateway', 'lets instances without public IPs start outbound connections (updates, APIs), but accepts none inbound', 'a public subnet'],
        ['Private subnet', 'its route table sends `0.0.0.0/0` to a NAT gateway, or nowhere', 'one AZ'],
        ['Security group', 'a **stateful** firewall on each instance: allow rules only, deny by default, replies allowed automatically', 'each network interface'],
        ['Network ACL', 'a **stateless** filter on each subnet: allow and deny rules, both directions checked', 'each subnet'],
    ], 'The parts of a VPC'),
    P('''Planning the address space is the `ipaddress` work from the addressing chapter. Leave room to grow: you cannot shrink a VPC later,
    and overlapping ranges make it impossible to connect two VPCs or your home network over a VPN:'''),
    RUN('''
    import ipaddress

    vpc = ipaddress.ip_network("10.20.0.0/16")
    subnets = list(vpc.subnets(new_prefix=20))         # 16 blocks of 4096 addresses
    plan = {
        "public-a": subnets[0], "public-b": subnets[1],
        "private-a": subnets[4], "private-b": subnets[5],
        "data-a": subnets[8], "data-b": subnets[9],
    }
    for name, net in plan.items():
        usable = net.num_addresses - 5                  # AWS reserves 5 addresses in every subnet
        print(f"{name:<10} {str(net):<15} {usable:>5} usable")
    print("spare /20 blocks for later:", len(subnets) - len(plan))
    print("overlaps home LAN 192.168.1.0/24?", vpc.overlaps(ipaddress.ip_network("192.168.1.0/24")))
    '''),
    P('''Now wire it up. The lab below is a small VPC: a web server and a NAT gateway in a public subnet, a database in a private one. The
    seven tests show who can reach what, and each one expands to the reasoning a cloud network actually applies. Break it on purpose: remove
    routes, add public IPs, open ports to the world, and read which step fails.'''),
    WIDGET('vpclab'),
    CALLOUT('try', 'Questions the lab answers', '''Why does giving `db` a public IP not make it reachable? Why does removing the public route break `db`'s updates even though `db` is in
    the *private* subnet? Which single rule in `db-sg` is better than "Postgres from the whole VPC", and why? Why does a blocked connection look
    like a timeout to the client, not a refusal?'''),

    H2('IAM: who may do what', 'iam'),
    P('''Every cloud API call is checked against **IAM** (identity and access management). A **principal** (a user, a role assumed by a
    service or a person, or another account) makes a **request** (an action such as `s3:GetObject` on a **resource** such as
    `arn:aws:s3:::lab-reports/2026/q3.csv`), and **policies** decide. Policies are JSON documents of statements:'''),
    JSON_('''
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "ReadReports",
          "Effect": "Allow",
          "Action": ["s3:GetObject"],
          "Resource": "arn:aws:s3:::lab-reports/*",
          "Condition": { "IpAddress": { "aws:SourceIp": "203.0.113.0/24" } }
        },
        {
          "Sid": "NeverDelete",
          "Effect": "Deny",
          "Action": "s3:DeleteObject",
          "Resource": "*"
        }
      ]
    }
    '''),
    P('''The evaluation logic, simplified to one account, has three rules. Everything starts **denied**. A matching `Allow` statement
    allows. A matching `Deny` statement overrides any number of allows. `Version` is the policy language version, always `2012-10-17`, not
    a date you change. Test that in the simulator below, then try the "Far too broad" preset with `iam:CreateAccessKey`: `"Action": "*"` on
    `"Resource": "*"` is a full administrator, and is the policy most often found attached to leaked keys.'''),
    WIDGET('iamsim'),
    UL('**Least privilege**: grant the specific actions on the specific resources a job needs, and nothing else. Start narrow and add; it is much harder to take permissions away later.',
       '**Roles, not keys**: give a VM, container or function a *role*, and the platform hands it short-lived credentials that rotate automatically. Nothing to leak in code.',
       '**Humans through single sign-on with MFA**, never through long-lived access keys in `~/.aws/credentials`.',
       '**Guardrails at the top**: organisations can attach policies (AWS SCPs, Azure Policy) that no one below can override, for example "never disable logging" or "only these regions".'),
    EX('cloud-ex-a-tiny-policy-evaluator', 'A tiny policy evaluator', 'py',
       '''Write `decide(policy, action, resource)` that returns `"allow"`, `"explicit-deny"` or `"implicit-deny"` for a policy shaped like the
       JSON above, without conditions. `Action` and `Resource` may be a string or a list. Wildcards: `*` matches any run of characters, and
       actions compare case-insensitively (resources do not). Use `fnmatch.fnmatchcase` and lower-case the action and pattern yourself.''',
       '''
       from fnmatch import fnmatchcase

       def as_list(x):
           return x if isinstance(x, list) else [x]

       def matches(statement, action, resource):
           ok_action = any(fnmatchcase(action.lower(), a.lower()) for a in as_list(statement["Action"]))
           ok_resource = any(fnmatchcase(resource, r) for r in as_list(statement["Resource"]))
           return ok_action and ok_resource

       def decide(policy, action, resource):
           hits = [s for s in as_list(policy["Statement"]) if matches(s, action, resource)]
           if any(s["Effect"] == "Deny" for s in hits):
               return "explicit-deny"
           if any(s["Effect"] == "Allow" for s in hits):
               return "allow"
           return "implicit-deny"
       ''',
       hints=['Collect every statement that matches first, then decide: any Deny wins, then any Allow, otherwise the default.',
              '`fnmatchcase("s3:getobject", "s3:get*")` is True; `fnmatch` without `case` would follow the operating system\'s case rules, which differ between macOS and Linux.'],
       why='''Evaluating all matching statements before deciding is the point: the order of statements in a policy never matters, and one
       Deny anywhere beats every Allow. Real IAM adds conditions, `NotAction`, resource policies, permission boundaries and organisation
       policies, but each of those is another place a Deny can come from or an Allow must also exist.''',
       starter='''
       from fnmatch import fnmatchcase

       def decide(policy, action, resource):
           return "allow"
       ''',
       check='''
       P = {"Version": "2012-10-17", "Statement": [
           {"Effect": "Allow", "Action": "s3:Get*", "Resource": "arn:aws:s3:::lab/*"},
           {"Effect": "Allow", "Action": ["s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::lab/*"},
           {"Effect": "Deny", "Action": "s3:DeleteObject", "Resource": "arn:aws:s3:::lab/keep/*"}]}
       assert decide(P, "s3:GetObject", "arn:aws:s3:::lab/a.txt") == "allow", "Get* should allow GetObject"
       assert decide(P, "S3:GETOBJECT", "arn:aws:s3:::lab/a.txt") == "allow", "Actions compare case-insensitively"
       assert decide(P, "s3:GetObject", "arn:aws:s3:::LAB/a.txt") == "implicit-deny", "Resources compare case-sensitively"
       assert decide(P, "s3:DeleteObject", "arn:aws:s3:::lab/a.txt") == "allow", "DeleteObject on lab/a.txt is allowed"
       assert decide(P, "s3:DeleteObject", "arn:aws:s3:::lab/keep/x") == "explicit-deny", "The Deny must override the Allow"
       assert decide(P, "s3:ListBucket", "arn:aws:s3:::lab") == "implicit-deny", "Nothing allows ListBucket"
       one = {"Statement": {"Effect": "Allow", "Action": "*", "Resource": "*"}}
       assert decide(one, "iam:CreateUser", "anything") == "allow", "Statement may be a single object, and * matches everything"
       '''),

    H2('Infrastructure as code', 'iac'),
    P('''Clicking through a web console is fine for learning and terrible for anything you need twice. **Infrastructure as code** describes
    resources in files that live in Git: you review changes like code, recreate an environment from scratch, and see exactly what will change
    before it changes. Terraform and its open-source fork OpenTofu use the same HCL language and work with every major cloud. This file creates
    a private, versioned S3 bucket:'''),
    FILE('main.tf', '''
    terraform {
      required_providers {
        aws = { source = "hashicorp/aws", version = "~> 6.0" }
      }
    }

    provider "aws" {
      region = "eu-west-2"
    }

    resource "aws_s3_bucket" "reports" {
      bucket = "lab-reports-learner-2026"
      tags   = { project = "lab", owner = "learner" }
    }

    resource "aws_s3_bucket_versioning" "reports" {
      bucket = aws_s3_bucket.reports.id
      versioning_configuration { status = "Enabled" }
    }

    resource "aws_s3_bucket_public_access_block" "reports" {
      bucket                  = aws_s3_bucket.reports.id
      block_public_acls       = true
      block_public_policy     = true
      ignore_public_acls      = true
      restrict_public_buckets = true
    }

    output "bucket_arn" {
      value = aws_s3_bucket.reports.arn
    }
    '''),
    SH('''
    brew install hashicorp/tap/terraform
    terraform init
    terraform fmt && terraform validate
    terraform plan
    terraform apply
    terraform destroy
    '''),
    P('''`plan` is the important one: it compares the files with what exists and prints every create, change and destroy before anything
    happens. Read it every time, especially lines that say `must be replaced`. Terraform records what it manages in a **state** file; for
    anything shared, keep state in remote storage with locking, never in Git, because it can contain secrets. OpenTofu installs with
    `brew install opentofu` and uses `tofu` in place of `terraform`.'''),

    H2('Cost and safety', 'cost'),
    P('''Cloud bills are usage-based, which is wonderful until something runs that you forgot about. New AWS accounts now start on a
    credit-based free plan with spending limits, and Azure and Google Cloud offer trial credits plus always-free tiers; the details change
    often, so read each provider's current terms before you create resources. Whatever the provider, these habits keep a learning account
    cheap:'''),
    OL('**Set a budget alarm on day one** (AWS Budgets, Azure Cost Management, Google Cloud Billing budgets) at a figure you would not mind losing.',
       '**Turn on MFA for the root account**, then stop using it. Work as an SSO user or IAM user with limited permissions.',
       '**Tag everything** with `project` and `owner`, so you can find and delete it later.',
       '**Destroy what you are not using**: `terraform destroy`, or delete the stack. Stopped VMs still pay for their disks and public IPv4 addresses.',
       '**Watch the quiet costs**: NAT gateways bill by the hour and per gigabyte, data leaving the cloud (egress) costs money, and public IPv4 addresses are charged by the hour on AWS.'),
    RUN('''
    # Example rates for illustration only: real prices differ by provider, region and date.
    RATES = {
        "small VM (2 vCPU, 4 GB)": (0.04, "hour"),
        "public IPv4 address": (0.005, "hour"),
        "NAT gateway": (0.045, "hour"),
        "NAT data processed": (0.045, "GB"),
        "object storage": (0.023, "GB-month"),
        "data out to the internet": (0.09, "GB"),
    }
    usage = {"small VM (2 vCPU, 4 GB)": 730, "public IPv4 address": 730, "NAT gateway": 730,
             "NAT data processed": 50, "object storage": 200, "data out to the internet": 100}

    total = 0
    for item, qty in usage.items():
        rate, unit = RATES[item]
        cost = rate * qty
        total += cost
        print(f"{item:<26} {qty:>5} {unit:<9} ${cost:7.2f}")
    print(f"{'monthly total':<42} ${total:7.2f}")
    print(f"the NAT gateway alone is {100 * (RATES['NAT gateway'][0] * 730 + 0.045 * 50) / total:.0f}% of the bill")
    '''),
    P('''The surprise in that estimate is typical: the NAT gateway costs more than the server it serves. In a learning account, a private
    subnet that needs only occasional updates can use VPC endpoints for the provider's own services, or simply be short-lived.'''),

    H2('Cloud, homelab or both?', 'homelab'),
    TABLE(['Question', 'Homelab', 'Cloud'], [
        ['Upfront cost', 'hardware you buy once', 'nothing'],
        ['Running cost', 'electricity; predictable', 'per hour and per GB; can surprise you'],
        ['Reachable from the internet', 'needs port forwarding, dynamic DNS or a tunnel', 'public IPs and load balancers on demand'],
        ['Scaling', 'buy more hardware', 'an API call'],
        ['Resilience', 'one house, one power supply, one connection', 'multiple AZs and regions'],
        ['What you learn', 'hardware, networks, Linux end to end', 'managed services, IAM, IaC, the skills employers ask for'],
    ]),
    P('''You do not have to choose. A common path is to learn Linux, services and networking on a Raspberry Pi or a homelab VM, where
    mistakes cost nothing, then reproduce the same service in the cloud with Terraform. Tools such as Tailscale or Cloudflare Tunnel connect
    the two without opening ports on your router.'''),
    EX('cloud-ex-design-a-small-deployment', 'Design a small deployment', 'think',
       '''You are deploying the lab API with a PostgreSQL database for a small team. Describe: which subnets the API, the database and a load
       balancer go in; the inbound rules of each security group; how the API gets the database password; how you would deploy a new version;
       and two things you would set up on day one to avoid a surprise bill or breach.''',
       '''Load balancer in public subnets in two AZs; security group allows 443 from 0.0.0.0/0.
API containers (or VMs) in private subnets in two AZs; security group allows 8080 only from the load balancer's security group.
Database (managed, e.g. RDS) in private data subnets; security group allows 5432 only from the API's security group. No public IPs anywhere except the load balancer.
Database password in a secret store (Secrets Manager / Key Vault / Secret Manager), read at start-up by the API through its IAM role; nothing in the image or the repository.
Deploy by building and pushing a new image tag, then updating the service (rolling update behind the health check), all described in Terraform and applied after reading terraform plan.
Day one: a budget alarm, MFA on the root account with SSO for people, CloudTrail (audit logging) on, and tags on every resource.''',
       hints=['Follow a request from the internet inward and allow only the previous hop at each layer.', 'Every secret needs a home that is not code, an image or Git.'],
       why='''The pattern, public entry point, private application, more private data, each layer accepting traffic only from the layer in
       front of it, is the same whether you use VMs, containers or functions. Referring to security groups instead of IP ranges keeps the rules
       correct as instances come and go.'''),

    CHECK('cloud-ch-cloud-checkpoint', 'Cloud checkpoint',
          Q('In IaaS, who patches the operating system of your VM?', [('The provider', False), ('You', True), ('Nobody; cloud VMs do not need patches', False), ('The hypervisor', False)],
            'IaaS gives you a machine. Everything from the OS up, including patches and firewall rules, is on your side of the shared-responsibility line.'),
          Q('What makes a subnet "public"?', [('A checkbox on the subnet', False), ('Its route table sends 0.0.0.0/0 to an internet gateway', True), ('It uses public IP addresses for its range', False), ('It has a NAT gateway in it', False)],
            'Routing decides. An instance in that subnet also needs a public IP and a security group that allows the traffic.'),
          Q('A security group allows inbound 443. Do you also need an outbound rule for the replies?', [('Yes, always', False), ('No: security groups are stateful and allow replies to allowed traffic', True), ('Only for HTTPS', False), ('Only in private subnets', False)],
            'Stateful filters track connections. Network ACLs are stateless and do need rules for both directions.'),
          Q('A policy allows `s3:*` on a bucket, and another attached policy denies `s3:DeleteObject`. Can the user delete objects?', [('Yes, the Allow came first', False), ('Yes, because s3:* is more general', False), ('No: an explicit Deny overrides any Allow', True), ('Only with MFA', False)],
            'Order never matters in IAM. One matching Deny wins.'),
          Q('Why should a container\'s server bind to 0.0.0.0 rather than 127.0.0.1?', [('It is faster', False), ('Published ports arrive on the container\'s network interface, not its loopback', True), ('Docker requires it for TLS', False), ('127.0.0.1 is reserved for the host', False)],
            'Inside the container, loopback is the container itself. Port publishing forwards to the container\'s own interface.'),
          Q('Which command should you read carefully before every infrastructure change?', [('terraform init', False), ('terraform plan', True), ('terraform fmt', False), ('terraform output', False)],
            '`plan` shows every create, change and destroy before it happens. Lines saying a resource must be replaced deserve extra attention.')),

    PROJECT('cloud-pr-ship-the-lab-api', 'Ship the lab API: container, scan, deploy', 'intermediate', 60,
            ['Docker', 'health checks', 'IaC', 'least privilege', 'cost control'],
            P('''Take the API from Server Basics all the way to something deployable, with every step reproducible from files in one Git
            repository. Parts 1 to 3 need only your Mac. Part 4 is optional and uses a cloud account with a budget alarm set first.'''),
            H3('1. Containerise'),
            P('''Make the bind address and port come from environment variables, build the image from this chapter's `Dockerfile`, run it with
            the port published to `127.0.0.1`, and confirm `docker ps` shows the container as `healthy` after the health check has run.'''),
            H3('2. Make it twelve-factor friendly'),
            P('''Log to stdout only (the platform collects it), read every setting from the environment, and handle `SIGTERM` by finishing the
            current request and exiting, which is how platforms stop containers during a deploy. Test with `docker stop`, which sends `SIGTERM`
            and waits ten seconds before killing.'''),
            H3('3. Check what you ship'),
            P('''List the image's size and layers with `docker history labapi:1.0`. Scan it for known vulnerabilities with a scanner such as
            Trivy (`brew install trivy`, then `trivy image labapi:1.0`) and note which findings come from the base image. Try a smaller base and
            compare.'''),
            H3('4. Deploy (optional, with a budget alarm in place)'),
            UL('Push the image to a registry (GitHub Container Registry is free for public images).',
               'Run it on a managed container platform (Cloud Run, Azure Container Apps, or AWS App Runner or ECS on Fargate), described in Terraform or OpenTofu.',
               'Give it a role with no permissions at all, since it needs none, and confirm with the provider\'s IAM tools.',
               'Point `watch_api.zsh` from Server Basics at the public URL, then `terraform destroy` and check the bill the next day.'),
            H3('5. Stretch goals'),
            UL('Add a managed database in a private subnet and store its password in the platform\'s secret store.', 'Put the service behind a custom domain with an automatically renewed certificate, and check it with `openssl s_client`.')),
]

terms = [
    ('IaaS / PaaS / SaaS', 'infrastructure, platform and software as a service: how much of the stack the provider runs for you'),
    ('region', 'a geographic area containing several availability zones'),
    ('availability zone', 'one or more data centres in a region with independent power and networking'),
    ('container', 'an isolated process started from an image of filesystem layers, sharing the host kernel'),
    ('cold start', 'the extra delay when a serverless platform must start a fresh environment for a function'),
    ('object storage', 'a service that stores whole files as objects addressed by key in buckets, over an HTTP API'),
    ('presigned URL', 'a time-limited link to one private object, authorised by a signature in its query string'),
    ('VPC', 'virtual private cloud: a private network in a region, divided into subnets'),
    ('security group', 'a stateful, allow-only firewall attached to cloud instances'),
    ('NAT gateway', 'lets private instances make outbound connections without accepting inbound ones'),
    ('IAM', 'identity and access management: principals, policies and the rules that evaluate requests'),
    ('least privilege', 'granting only the permissions a task needs, on only the resources it needs'),
    ('infrastructure as code', 'describing cloud resources in versioned files that a tool such as Terraform applies'),
]

CHAPTER = chapter('cloud', 'Cloud Computing: Compute, Storage, Networks and IAM',
                  'Choose between VMs, containers and functions, plan a VPC, lock down access with IAM, describe it all as code and keep the bill under control',
                  'crypto', 130,
                  ['Explain IaaS, PaaS, SaaS and functions, and where the shared-responsibility line falls for each',
                   'Containerise a service and run it locally with the right port and bind address',
                   'Plan VPC address space and predict reachability from routes, public IPs and security groups',
                   'Read and write IAM policies, and explain how explicit deny, allow and default deny combine',
                   'Describe infrastructure as code with Terraform or OpenTofu, and keep a learning account safe and cheap'],
                  blocks, terms, file='40-cloud.gm')
