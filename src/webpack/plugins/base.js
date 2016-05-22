import { HotModuleReplacementPlugin } from 'webpack'
import CleanWebpackPlugin from 'clean-webpack-plugin'
import path from 'path'

export default {
  name: 'base',
  configure ({ buildTarget, projectPath, saguiPath }) {
    const modulesDirectories = [
      path.join(projectPath, '/node_modules'),
      path.join(saguiPath, '/node_modules')
    ]

    return {
      context: path.join(projectPath, 'src'),

      devtool: 'source-map',

      plugins: buildPlugins(buildTarget, projectPath),

      resolve: { root: modulesDirectories },
      resolveLoader: { modulesDirectories }
    }
  }
}

function buildPlugins (buildTarget, projectPath) {
  let plugins = [
    new CleanWebpackPlugin(['dist'], {
      root: projectPath,
      verbose: false
    })
  ]

  if (buildTarget === 'development') {
    plugins.push(new HotModuleReplacementPlugin())
  }

  return plugins
}
