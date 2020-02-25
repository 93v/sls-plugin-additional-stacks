# sls-plugin-additional-stacks

![David](https://img.shields.io/david/93v/sls-plugin-additional-stacks.svg)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/93v/sls-plugin-additional-stacks.svg)
![GitHub repo size](https://img.shields.io/github/repo-size/93v/sls-plugin-additional-stacks.svg)
![npm](https://img.shields.io/npm/dw/sls-plugin-additional-stacks.svg)
![npm](https://img.shields.io/npm/dm/sls-plugin-additional-stacks.svg)
![npm](https://img.shields.io/npm/dy/sls-plugin-additional-stacks.svg)
![npm](https://img.shields.io/npm/dt/sls-plugin-additional-stacks.svg)
![NPM](https://img.shields.io/npm/l/sls-plugin-additional-stacks.svg)
![npm](https://img.shields.io/npm/v/sls-plugin-additional-stacks.svg)
![GitHub last commit](https://img.shields.io/github/last-commit/93v/sls-plugin-additional-stacks.svg)
![npm collaborators](https://img.shields.io/npm/collaborators/sls-plugin-additional-stacks.svg)

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
sls remove additionalStacks --all
```

## TODO

- Add tests
