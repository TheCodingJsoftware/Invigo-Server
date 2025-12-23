const { merge } = require("webpack-merge");
const common = require("./webpack.common");
const globAll = require("glob-all");
const path = require("path");

const CompressionPlugin = require("compression-webpack-plugin");
const { PurgeCSSPlugin } = require("purgecss-webpack-plugin");
const { EsbuildPlugin } = require("esbuild-loader");

const ROOT = process.cwd();

module.exports = merge(common, {
    mode: "production",
    devtool: false,

    output: {
        filename: "js/[name].[contenthash].js"
    },

    optimization: {
        minimize: true,
        minimizer: [
            new EsbuildPlugin({
                target: "ES2020",
                css: true
            })
        ],
        splitChunks: {
            chunks: "all"
        }
    },

    plugins: [
        new PurgeCSSPlugin({
            paths: globAll.sync([
                path.join(ROOT, 'src/**/*.{ts,tsx,js,jsx,html}'),
                path.join(ROOT, 'src/pages/**/*.html'),
            ]),
            safelist: { standard: [/^html/, /^body/, /^#/, /^\.*/] },
        }),
        // new CompressionPlugin({
        //     filename: '[path][base].gz',      // generate .gz files
        //     algorithm: 'gzip',
        //     test: /\.(js|css|html|svg)$/,
        //     threshold: 10240,                  // only compress files >10 KB
        //     minRatio: 0.8
        // }),
        // new CompressionPlugin({
        //     filename: '[path][base].br',       // generate .br files
        //     algorithm: 'brotliCompress',
        //     test: /\.(js|css|html|svg)$/,
        //     compressionOptions: { level: 11 },
        //     threshold: 10240,
        //     minRatio: 0.8
        // }),
    ]
});
