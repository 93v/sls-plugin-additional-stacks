# sls-plugin-additional-stacks

Serverless Framework Plugin to Deploy and Remove AWS Additional Stacks

## Installation

To install with npm, run this in your service directory:

```bash
npm install --save sls-plugin-additional-stacks
```

Then add this to your `serverless.yml`

```yml
plugins:
  - sls-plugin-additional-stacks
```

## Configuration

To define Additional Stacks, add a `additionalStacks` section like this to your
`serverless.yml`:

```yml
custom:
  additionalStacks:
    users: ...
```

## Command Line Usage

Your Additional Stacks will be deployed automatically when you run:

```bash
sls deploy
```

To deploy all Additional Stacks without deploying the Serverless service, use:

```bash
sls deploy additionalStacks
```

To deploy a single Additional Stack without deploying the Serverless service, use:

```bash
sls deploy additionalStacks --stack [appName]
```

To only deploy the Serverless service without deploying the Additional Stacks, use:

```bash
sls deploy --skipAdditionalStacks
```

To remove a single Additional Stack without removing the Serverless service, use:

```bash
sls remove additionalStacks --stack [appName]
```

To remove all Additional Stacks without removing the Serverless service, use:

```bash
sls remove additionalStacks
```

## TODO

- Add tests

## Known Issues

- At this moment the plugin does not allow the serverless framework to correctly understand the stacks for offline
