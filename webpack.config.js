const path = require('path');
const fs = require('fs');
const globAll = require('glob-all');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { GenerateSW } = require('workbox-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const { PurgeCSSPlugin } = require('purgecss-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { EsbuildPlugin } = require('esbuild-loader');

class NonBlockingCssPlugin {
    apply(compiler) {
        compiler.hooks.compilation.tap('NonBlockingCssPlugin', (compilation) => {
            HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tap('NonBlockingCssPlugin', (data) => {
                data.assetTags.styles = (data.assetTags.styles || []).map((tag) => {
                    if (tag.tagName === 'link' && tag.attributes && tag.attributes.rel === 'stylesheet') {
                        tag.attributes.media = 'print';
                        tag.attributes.onload = "this.media='all'";
                    }
                    return tag;
                });
                return data;
            });
        });
    }
}

const isProduction = process.env.NODE_ENV === 'production';
const entries = {};
const pagesDir = path.join(__dirname, 'src/pages');

// Dynamically find page entries
fs.readdirSync(pagesDir).forEach(folder => {
    const tsEntry = path.join(pagesDir, folder, `${folder}.ts`);
    const jsEntry = path.join(pagesDir, folder, `${folder}.js`);

    if (fs.existsSync(tsEntry)) {
        entries[folder] = tsEntry;
    } else if (fs.existsSync(jsEntry)) {
        entries[folder] = jsEntry;
    } else {
        console.warn(`⚠️ No entry file found for: ${folder}`);
    }
});

// Create HtmlWebpackPlugins dynamically
const htmlPlugins = Object.keys(entries).map(name => {
    const templatePath = path.join(pagesDir, name, `${name}.html`);
    if (fs.existsSync(templatePath)) {
        return new HtmlWebpackPlugin({
            template: templatePath,
            filename: `html/${name}.html`,
            chunks: [name, `vendors~${name}`],
            minify: isProduction,
        });
    }
    console.warn(`⚠️ No HTML template found for: ${name}`);
    return null;
}).filter(Boolean);

module.exports = {
    mode: isProduction ? 'production' : 'development',

    entry: entries,

    output: {
        filename: isProduction ? 'js/[name].[contenthash].js' : 'js/[name].bundle.js',
        path: path.resolve(__dirname, 'public'),
        publicPath: '/public/',
        clean: true,
    },

    devtool: isProduction ? false : 'source-map',

    devServer: {
        static: { directory: path.join(__dirname, 'public') },
        compress: true,
        hot: true,
        open: true,
        historyApiFallback: true,
        client: { overlay: true },
    },

    cache: {
        type: 'filesystem',
        compression: 'gzip',
    },

    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        alias: {
            '@interfaces': path.resolve(__dirname, 'src/interfaces'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@types': path.resolve(__dirname, 'src/types'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@static': path.resolve(__dirname, 'src/static'),
            '@models': path.resolve(__dirname, 'src/models'),
            '@config': path.resolve(__dirname, 'src/config'),
            '@core': path.resolve(__dirname, 'src/core'),
        },
        fallback: {
            fs: false,
            path: false,
            buffer: false,
        },
    },

    module: {
        rules: [
            {
                test: /pdf\.worker(\.min)?\.m?js$/,
                type: "asset/resource"
            },
            {
                test: /\.ts$/,
                loader: 'esbuild-loader',
                options: {
                    loader: 'ts',
                    target: 'es2017',
                },
            },
            {
                test: /\.js$/,
                loader: 'esbuild-loader',
                options: {
                    loader: 'js',
                    target: 'es2017',
                },
            },
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: { sourceMap: false },
                    },
                ],
            },
        ],
    },
    optimization: {
        minimize: isProduction,  // only minify in production
        minimizer: [
            new EsbuildPlugin({
                target: 'ES2020',  // match your loader target
                css: true,         // also minify CSS
            }),
        ],
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                vendorsPerPage: {
                    test: /[\\/]node_modules[\\/]/,
                    name(module, chunks) {
                        return `vendors~${chunks[0].name}`;
                    },
                    chunks: 'async', // <- only load if the chunk is imported
                    enforce: true,
                    reuseExistingChunk: false,
                },
            }
        },
    },
    plugins: [
        new CompressionPlugin({
            filename: '[path][base].gz',      // generate .gz files
            algorithm: 'gzip',
            test: /\.(js|css|html|svg)$/,     // compress these file types
            threshold: 10240,                  // only compress files >10 KB
            minRatio: 0.8
        }),
        new CompressionPlugin({
            filename: '[path][base].br',       // generate .br files
            algorithm: 'brotliCompress',
            test: /\.(js|css|html|svg)$/,
            compressionOptions: { level: 11 },
            threshold: 10240,
            minRatio: 0.8
        }),
        new PurgeCSSPlugin({
            paths: globAll.sync([
                path.join(__dirname, 'src/**/*.{ts,tsx,js,jsx,html}'),
                path.join(__dirname, 'src/pages/**/*.html'),
            ]),
            safelist: { standard: [/^html/, /^body/, /^#/, /^\.*/] },
        }),
        new MiniCssExtractPlugin({
            filename: isProduction ? 'css/[name].[contenthash].css' : 'css/[name].bundle.css',
        }),
        new ForkTsCheckerWebpackPlugin({
            async: true,
            typescript: {
                memoryLimit: 4096,
                configFile: path.resolve(__dirname, 'tsconfig.json'),
                diagnosticOptions: {
                    semantic: true,
                    syntactic: true,
                },
                mode: 'write-references',
            },
        }),
        ...htmlPlugins,
        new NonBlockingCssPlugin(),
        // new GenerateSW({
        //     swDest: 'service-worker.js',
        //     clientsClaim: true,
        //     skipWaiting: true,
        //     maximumFileSizeToCacheInBytes: 32 * 1024 * 1024,
        //     runtimeCaching: [
        //         {
        //             urlPattern: ({ request }) => request.mode === 'navigate',
        //             handler: 'NetworkOnly',
        //             options: { cacheName: 'html-pages' },
        //         },
        //         {
        //             urlPattern: /\.js$/,
        //             handler: 'NetworkOnly',
        //             options: { cacheName: 'js-cache' },
        //         },
        //         {
        //             urlPattern: /\.(?:css|png|jpg|jpeg|svg|woff2?)$/,
        //             handler: 'StaleWhileRevalidate',
        //             options: { cacheName: 'static-assets' },
        //         },
        //     ],
        // }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'src', 'static'),
                    to: path.resolve(__dirname, 'public', 'static'),
                    noErrorOnMissing: true,
                },
                {
                    from: path.resolve(__dirname, 'src', 'manifest.json'),
                    to: path.resolve(__dirname, 'public', 'manifest.json'),
                },
                {
                    from: path.resolve(__dirname, 'src', 'robots.txt'),
                    to: path.resolve(__dirname, 'public', 'robots.txt'),
                    noErrorOnMissing: true,
                },
                {
                    from: path.resolve(__dirname, 'src', 'google9d968a11b4bf61f7.html'),
                    to: path.resolve(__dirname, 'public', 'google9d968a11b4bf61f7.html'),
                    noErrorOnMissing: true,
                },
            ],
        }),
    ],
    stats: {
        errorDetails: true,
        logging: 'verbose',
    },
};
