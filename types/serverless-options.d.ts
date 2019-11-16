import Serverless from "serverless";

export interface ServerlessOptions extends Serverless.Options {
  all?: string;
  skipAdditionalStacks?: boolean;
  stack?: string;
}
