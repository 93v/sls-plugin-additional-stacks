export interface AdditionalStack {
  Conditions?: any | null;
  Deploy?: any | null;
  Description?: any | null;
  Mappings?: any | null;
  Metadata?: any | null;
  Outputs?: any | null;
  Parameters?: any | null;
  Resources?: any | null;
  StackName?: string | null;
  Tags?: any | null;
  Transform?: any | null;
}

export type IAdditionalStacksMap = Record<string, AdditionalStack>;
