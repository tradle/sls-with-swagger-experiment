
import { build } from './swagger'
import { PreProcessor } from './preprocess'

export = class Swaggle {
  private serverless: any
  private provider: string
  private hooks: any
  private naming: any
  constructor(serverless) {
    this.naming = serverless.providers.aws.naming
    this.serverless = serverless
    this.hooks = {
      'aws:package:finalize:mergeCustomProviderResources': () => this.refactorApiGatewayStuff()
    }
  }

  public refactorApiGatewayStuff = async () => {
    const { service } = this.serverless
    const { provider } = service
    const swagger = build(service, {
      binaryMimeTypes: '*/*'
    })

    const template = provider.compiledCloudFormationTemplate
    const preprocessor = new PreProcessor()
    preprocessor.mangleYml({
      service,
      cf: template,
      naming: this.naming,
      apiName: 'Api',
      swagger
    })
  }
}
