export interface ICors {
  allowCredentials?: boolean
  headers: string[]
  methods: string[]
  origin?: string
  origins: string[]
}

export interface IHttpEventConf {
  path: string
  method: string
  cors?: ICors
}

export interface IEventConf {
  http?: IHttpEventConf
}

export interface IFnConf {
  events: IEventConf[]
}

export interface IResourceConf {
  Type: string
  Properties?: any
  [other: string]: any
}

export interface IOutputConf {
  Description?: string
  Value?: any
}

export type Functions = {
  [shortName: string]: IFnConf
}

export type Resources = {
  [shortName: string]: IResourceConf
}

export type Outputs = {
  [shortName: string]: IOutputConf
}

export interface IProvider {
  stage: string
}

export type ResourcesSection = {
  Resources?: Resources
  Outputs?: Outputs
}

export interface IServerlessYml {
  service: string
  provider: IProvider
  functions: Functions
  resources: ResourcesSection
}

export interface IBuildOpts {
  binaryMimeTypes?: string|string[]
  apiName?: string
}

export interface IPreProcessOpts {
  prePath: string
  apiName?: string
  dest?: string
}
