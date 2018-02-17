require('source-map-support').install()

import proc = require('child_process')
import path = require('path')
import fs = require('fs')
import _ = require('lodash')
import YAML = require('js-yaml')
import { build } from './builder'

const compile = (preYmlPath: string) => {
  const ymlPath = path.join(path.dirname(preYmlPath), 'serverless.yml')
  const execOpts = {
    cwd: process.cwd()
  }

  proc.execSync(`cp "${preYmlPath}" "${ymlPath}"`, execOpts)
  proc.execSync(`sls print`, execOpts)
  const interpolated = fs.readFileSync(ymlPath)
  const swagger = build(interpolated, {
    binaryMimeTypes: '*/*'
  })

  const yml = YAML.load(fs.readFileSync(preYmlPath))
  if (!yml.resources) yml.resources = {}
  if (!yml.resources.Resources) yml.resources.Resources = {}
  if (!yml.resources.Resources.Api) {
    yml.resources.Resources.Api = {
      Type: 'AWS::ApiGateway::RestApi',
      Properties: {
        FailOnWarnings: true
      }
    }
  }

  // rm http events
  _.forEach(yml.functions, (conf, name) => {
    conf.events = conf.events.filter(({ http }) => !http)
    if (!conf.events.length) {
      delete conf.events
    }
  })

  yml.resources.Resources.Api.Properties.Body = swagger
  fs.writeFileSync(ymlPath, YAML.dump(yml))
}

compile(process.argv[2])
