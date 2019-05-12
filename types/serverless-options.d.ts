import Serverless from 'serverless';

export interface IServerlessOptions extends Serverless.Options {
  stack?: string;
  skipAdditionalStacks?: boolean;
}
