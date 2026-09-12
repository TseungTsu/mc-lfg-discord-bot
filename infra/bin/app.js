#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { BotStack } = require('../lib/bot-stack');

const app = new cdk.App();

new BotStack(app, 'McLfgBotStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
