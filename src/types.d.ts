export interface IHttpEventConf {
  path: string
  method: string
  cors?: boolean
}

export interface IEventConf {
  http?: IHttpEventConf
}

export interface IFnConf {
  events: IEventConf[]
}

export type Functions = {
  [shortName: string]: IFnConf
}

export interface IProvider {
  stage: string
}

export interface IServerlessYml {
  service: string
  provider: IProvider
  functions: Functions
}

export interface IBuildOpts {
  binaryMimeTypes?: string|string[]
}
