const path = require('path');

module.exports = {
  mode: 'development', // change to 'production' for builds
  entry: './src/index.ts',
  devtool: 'inline-source-map',
  devServer: {
    static: [
      { directory: path.resolve(__dirname, 'dist') },
      { directory: path.resolve(__dirname, 'Dataset'), publicPath: '/Dataset' },
    ],
    hot: true,
    port: 8080,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: false,
  },
};
