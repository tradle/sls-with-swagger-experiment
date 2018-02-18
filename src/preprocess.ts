
import proc = require('child_process')
import path = require('path')
import _fs = require('fs')
import promisify = require('pify')
import _ = require('lodash')
import YAML = require('js-yaml')
import { build } from './swagger'
import { IPreProcessOpts, IServerlessYml, ResourcesSection } from './types'
import { naming } from './serverless-utils'

const fs = promisify(_fs)

const genPermission = (apiLogicalId: string, lambdaShortName: string) => ({
  "Type": "AWS::Lambda::Permission",
  "Properties": {
    "Action": "lambda:invokeFunction",
    "FunctionName": {"Fn::GetAtt": [naming.getLambdaLogicalId(lambdaShortName), "Arn"]},
    "Principal": "apigateway.amazonaws.com",
    "SourceArn": {"Fn::Join": ["",
      ["arn:aws:execute-api:", {"Ref": "AWS::Region"}, ":", {"Ref": "AWS::AccountId"}, ":", {"Ref": apiLogicalId }, "/*"]
    ]}
  }
})

const genDeployment = (apiLogicalId: string, stage: string) => ({
  "Type": "AWS::ApiGateway::Deployment",
  "Properties": {
    "RestApiId": {"Ref": apiLogicalId },
    "StageName": stage
  }
})

export class PreProcessor {
  public preProcess = async ({
    apiName = 'Api',
    prePath,
    dest
  }: IPreProcessOpts) => {
    if (!dest) {
      dest = path.join(path.dirname(prePath), 'serverless.yml')
    }

    const execOpts = {
      cwd: process.cwd()
    }

    proc.execSync(`cp "${prePath}" "${dest}"`, execOpts)
    proc.execSync(`sls print`, execOpts)
    const interpolated = await fs.readFile(dest)
    const swagger = build(interpolated, {
      binaryMimeTypes: '*/*'
    })

    const yml: IServerlessYml = YAML.load(await fs.readFile(prePath))
    this.mangleYml({ service: yml, cf: yml.resources, swagger, apiName, naming })
    await fs.writeFile(dest, YAML.dump(yml))
  }

  public mangleYml = async ({ service, cf, swagger, apiName, naming }: {
    service: IServerlessYml
    cf: ResourcesSection
    swagger: any
    apiName: string
    naming: any
  }) => {
    if (!cf.Resources) {
      cf.Resources = {}
    }

    if (!cf.Outputs) {
      cf.Outputs = {}
    }

    this.removeServerlessApiGatewayStuff({ cf, naming })

    const { Resources, Outputs } = cf
    if (!Resources.Api) {
      Resources.Api = {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
          FailOnWarnings: true
        }
      }
    }

    // rm http events
    _.forEach(service.functions, (conf, name) => {
      conf.events = conf.events.filter(({ http }) => !http)
      Resources[naming.getLambdaApiGatewayPermissionLogicalId(name)] = genPermission(apiName, name)
    })

    Resources.Api.Properties.Body = swagger
    const deploymentId = `${apiName}Deployment`
    Resources[deploymentId] = genDeployment(apiName, service.provider.stage)
    // _.extend(Resources, LoggingResources)
    // Resources.ApiGatewayAccount = {
    //   "Type": "AWS::ApiGateway::Account",
    //   "Properties": {
    //     "CloudWatchRoleArn": {"Fn::GetAtt": ["ApiGatewayCloudWatchLogsRole", "Arn"] }
    //   }
    // }

    // Resources[`${apiName}ApiStage`] = {
    //   "DependsOn": ["ApiGatewayAccount"],
    //   "Type": "AWS::ApiGateway::Stage",
    //   "Properties": {
    //     "DeploymentId": {"Ref": deploymentId},
    //     "MethodSettings": [{
    //       "DataTraceEnabled": true,
    //       "HttpMethod": "*",
    //       "LoggingLevel": "INFO",
    //       "ResourcePath": "/*"
    //     }],
    //     "RestApiId": {"Ref": apiName},
    //     "StageName": "LATEST"
    //   }
    // }

    Outputs.ServiceEndpoint.Value['Fn::Join'][1][1].Ref = apiName
    // Outputs.RestApi = {
    //   Description: 'Rest API Id',
    //   Value: { Ref: apiName }
    // }
  }

  public removeServerlessApiGatewayStuff = ({ cf, naming }: {
    cf: ResourcesSection
    naming: any
  }) => {
    _.forEach(cf.Resources, (resource, logicalId) => {
      if (/^ApiGateway(Resource|Method|Deployment|RestApi)/.test(logicalId)) {
        console.log(`deleting: ${logicalId}`)
        delete cf.Resources[logicalId]
      }
    })
  }
}

export const preProcess = (opts: IPreProcessOpts) => new PreProcessor().preProcess(opts)

const LoggingResources = {
  "ApiGatewayCloudWatchLogsRole": {
    "Type": "AWS::IAM::Role",
      "Properties": {
      "AssumeRolePolicyDocument": {
        "Version": "2012-10-17",
          "Statement": [{
            "Effect": "Allow",
            "Principal": { "Service": ["apigateway.amazonaws.com"] },
            "Action": ["sts:AssumeRole"]
          }]
      },
      "Policies": [{
        "PolicyName": "ApiGatewayLogsPolicy",
        "PolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [{
            "Effect": "Allow",
            "Action": [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:DescribeLogGroups",
              "logs:DescribeLogStreams",
              "logs:PutLogEvents",
              "logs:GetLogEvents",
              "logs:FilterLogEvents"
            ],
            "Resource": "*"
          }]
        }
      }]
    }
  },

  "ApiGatewayAccount": {
    "Type": "AWS::ApiGateway::Account",
      "Properties": {
      "CloudWatchRoleArn": { "Fn::GetAtt": ["ApiGatewayCloudWatchLogsRole", "Arn"] }
    }
  }
}
