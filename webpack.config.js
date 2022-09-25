const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = () => ({
  entry: {
    lambda: './src/main/lambda/lambda.js',
    createConnectFlow: './src/main/connectFlow/createConnectFlow.js'
  },
  target: 'node',
  externals: [
    'aws-sdk'
  ],
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.js?$/,
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    libraryTarget: 'commonjs2',
    filename: '[name].js',
    path: path.resolve(__dirname, 'artifacts/main')
  },
  optimization: {
    minimize: false
  },
  // plugins: [
  //   new CopyWebpackPlugin({
  //     patterns: [
  //       { from: './src/main/connectFlow/flow', to: '../flow' }
  //     ]
  //   })
  // ]
});
