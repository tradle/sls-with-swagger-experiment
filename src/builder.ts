import _ = require('lodash')
import YAML = require('js-yaml')
import { genOptionsBlock } from './gen-options-block'
import { IEventConf, IHttpEventConf, IServerlessYml, Functions, IBuildOpts } from './types'

export class Builder {
  private functions: Functions
  private stage: string
  private service: string
  private prefix: string
  constructor({ service, provider, functions }: IServerlessYml) {
    const { stage } = provider
    this.service = service
    this.stage = stage
    this.functions = _.transform(_.cloneDeep(functions), (functions, conf, name) => {
      functions[name] = {
        ...conf,
        events: conf.events
          .filter(event => 'http' in event)
          .map(normalizeHttpEvent)
      }
    }, {})

    this.prefix = `${service}-${stage}`
  }

  public build = ({ binaryMimeTypes }: IBuildOpts) => {
    const { functions } = this
    const swagger = genBaseSwagger({
      service: this.service,
      stage: this.stage
    })

    const { paths } = swagger
    _.forEach(functions, (conf, name) => {
      // const methods = {}
      const httpEvents = conf.events.filter(event => 'http' in event)
      httpEvents.forEach(event => this.addEvent(name, paths, event))
    })

    const cors = {}
    _.forEach(functions, (conf, name) => {
      const httpEvents = conf.events
        .filter(event => 'http' in event)
        .map(event => event.http)

      httpEvents.forEach(event => {
        const { path, method } = event
        if (!cors[path]) cors[path] = {}
        if (hasCors(event)) {
          // TODO: load actual cors config
          cors[path][event.method] = true
        }
      }, {})
    })

    for (let path in cors) {
      paths[path].options = genOptionsBlock({
        methods: _.keys(cors[path])
      })
    }

    if (binaryMimeTypes) {
      swagger['x-amazon-apigateway-binary-media-types'] = [].concat(binaryMimeTypes)
    }

    return swagger
  }

  public addEvent = (lambdaName: string, paths: any, event: IEventConf) => {
    const { path, method } = event.http
    if (!paths[path]) {
      paths[path] = {}
    }

    const pathConf = paths[path]
    pathConf[method] = this.genMethodBlock(lambdaName, method)
  }

  public genMethodBlock = (lambdaName: string, method: string) => {
    return {
      responses: {},
      'x-amazon-apigateway-integration': {
        uri: {
          'Fn::Sub': 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${' + this.prefixId(lambdaName) + '.Arn}/invocations'
        },
        // uri : 'arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:210041114155:function:safe-dev-auth/invocations',
        passthroughBehavior : 'when_no_match',
        httpMethod : 'POST',
        type : 'aws_proxy'
      }
    }
  }

  private prefixId = (id:string):string => {
    return this.prefix + id
  }
}

export const build = (yml: IServerlessYml|string|Buffer, opts: IBuildOpts={}) => new Builder(loadYml(yml)).build(opts)

const hasCors = (event: IHttpEventConf) => event.cors

const genBaseSwagger = ({ service, stage }: {
  service: string
  stage: string
}) => ({
  swagger: '2.0',
  info: {
    version: '2017-11-28T19:34:08Z',
    title: `${stage}-${service}`
  },
  // host: 'yy6zli69ab.execute-api.us-east-1.amazonaws.com',
  basePath: `/${stage}`,
  schemes: ['https'],
  paths: {}
})

const normalizePath = path => path[0] === '/' ? path : `/${path}`

const normalizeHttpEvent = event => ({
  ...event,
  http: {
    ...event.http,
    path: normalizePath(event.http.path)
  }
})

const loadYml = (yml: IServerlessYml|string|Buffer): IServerlessYml => {
  if (typeof yml === 'string' || Buffer.isBuffer(yml)) {
    return YAML.load(yml)
  }

  return yml
}
