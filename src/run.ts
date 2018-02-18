require('source-map-support').install()

import path = require('path')
import { preProcess } from './preprocess'

preProcess({
  prePath: path.resolve(__dirname, '../serverless-pre.yml')
})
