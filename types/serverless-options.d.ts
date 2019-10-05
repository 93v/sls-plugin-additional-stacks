import Serverless from "serverless";

export interface IServerlessOptions extends Serverless.Options {
  all?: string;
  skipAdditionalStacks?: boolean;
  stack?: string;
}
