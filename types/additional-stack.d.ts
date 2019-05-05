export interface IAdditionalStack {
  Deploy?: any | null;
  StackName?: string | null;
  Conditions?: any | null;
  Description?: any | null;
  Mappings?: any | null;
  Metadata?: any | null;
  Outputs?: any | null;
  Parameters?: any | null;
  Resources?: any | null;
  Transform?: any | null;
  Tags?: any | null;
}

export interface IAdditionalStacksMap {
  [key: string]: IAdditionalStack;
}
