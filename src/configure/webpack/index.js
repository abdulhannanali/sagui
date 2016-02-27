import merge from 'webpack-merge'

import babel from './babel'
import base from './base'
import cssModules from './css-modules'
import defineNodeENV from './define-node-env'
import eslint from './eslint'
import json from './json'
import library from './library'
import media from './media'
import pages from './pages'
import scss from './scss'

export const plugins = [
  babel,
  base,
  cssModules,
  defineNodeENV,
  eslint,
  json,
  library,
  media,
  pages,
  scss
]

export default function configureWebpack (config) {
  const { disabledPlugins = [], webpackConfig: userWebpackConfig, ...extraConfig } = config

  const defaultWebpackConfig = plugins
    .filter(plugin => disabledPlugins.indexOf(plugin.name) === -1)
    .reduce((webpackConfig, plugin) => {
      return merge.smart(webpackConfig, plugin.configure(extraConfig))
    }, {})

  const webpackConfig = merge.smart(defaultWebpackConfig, userWebpackConfig)

  return { ...config, webpackConfig }
}
