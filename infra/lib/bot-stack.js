const cdk = require('aws-cdk-lib');
const ec2 = require('aws-cdk-lib/aws-ec2');
const iam = require('aws-cdk-lib/aws-iam');

const REPO_URL = 'https://github.com/TseungTsu/mc-lfg-discord-bot.git';
const APP_DIR = '/opt/app';
// Secrets (DISCORD_TOKEN, CLIENT_ID, GUILD_ID) are read from SSM at boot
// rather than baked into the AMI/user data, so nothing sensitive ends up in
// the CloudFormation template or instance metadata.
const PARAM_PREFIX = '/mc-lfg-bot';

class BotStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const securityGroup = new ec2.SecurityGroup(this, 'BotSecurityGroup', {
      vpc,
      description: 'mc-lfg-bot host - no inbound ports, outbound only',
      allowAllOutbound: true,
    });

    const role = new iam.Role(this, 'BotInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        // Enables `aws ssm start-session` access instead of opening SSH (port 22).
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter${PARAM_PREFIX}/*`],
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['kms:Decrypt'],
      resources: ['*'],
      conditions: { StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` } },
    }));

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'dnf update -y',
      'dnf install -y git',
      // better-sqlite3's prebuilt binaries require Node >=22; on Node 20
      // they load but segfault as soon as a native call is made.
      'curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -',
      // gcc-c++/make/python3 are a fallback in case no prebuilt better-sqlite3
      // binary matches this AMI's node/arch, so npm can build it from source.
      'dnf install -y nodejs gcc-c++ make python3',
      `git clone ${REPO_URL} ${APP_DIR}`,
      `cd ${APP_DIR}`,
      'npm ci --omit=dev',
      `DISCORD_TOKEN=$(aws ssm get-parameter --name "${PARAM_PREFIX}/discord-token" --with-decryption --query Parameter.Value --output text --region ${this.region})`,
      `CLIENT_ID=$(aws ssm get-parameter --name "${PARAM_PREFIX}/client-id" --with-decryption --query Parameter.Value --output text --region ${this.region})`,
      `GUILD_ID=$(aws ssm get-parameter --name "${PARAM_PREFIX}/guild-id" --with-decryption --query Parameter.Value --output text --region ${this.region} 2>/dev/null || true)`,
      `cat > ${APP_DIR}/.env <<EOF`,
      'DISCORD_TOKEN=$DISCORD_TOKEN',
      'CLIENT_ID=$CLIENT_ID',
      'GUILD_ID=$GUILD_ID',
      'EOF',
      `cat > /etc/systemd/system/mc-lfg-bot.service <<EOF
[Unit]
Description=MC LFG Discord Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF`,
      'systemctl daemon-reload',
      'systemctl enable --now mc-lfg-bot',
    );

    const instance = new ec2.Instance(this, 'BotHost', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
      securityGroup,
      role,
      userData,
      // User data only runs on first boot, so if we change the bootstrap
      // script, force a fresh instance to actually pick it up.
      userDataCausesReplacement: true,
    });

    new cdk.CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new cdk.CfnOutput(this, 'ConnectCommand', {
      value: `aws ssm start-session --target ${instance.instanceId} --region ${this.region}`,
    });
  }
}

module.exports = { BotStack };
