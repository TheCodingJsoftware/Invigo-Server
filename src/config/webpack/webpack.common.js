const path = require("path");
const fs = require("fs");
const globAll = require("glob-all");

const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { EsbuildPlugin } = require("esbuild-loader");

/* =========================
   ABSOLUTE PROJECT ROOT
   ========================= */
const ROOT = process.cwd();

/* =========================
   PLUGINS
   ========================= */
class NonBlockingCssPlugin {
    apply(compiler) {
        compiler.hooks.compilation.tap("NonBlockingCssPlugin", (compilation) => {
            HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tap(
                "NonBlockingCssPlugin",
                (data) => {
                    data.assetTags.styles = (data.assetTags.styles || []).map((tag) => {
                        if (
                            tag.tagName === "link" &&
                            tag.attributes &&
                            tag.attributes.rel === "stylesheet"
                        ) {
                            tag.attributes.media = "print";
                            tag.attributes.onload = "this.media='all'";
                        }
                        return tag;
                    });
                    return data;
                }
            );
        });
    }
}

/* =========================
   ENTRY DISCOVERY
   ========================= */
const isProduction = process.env.NODE_ENV === "production";
const entries = {};
const pagesDir = path.join(ROOT, "src/pages");

fs.readdirSync(pagesDir).forEach((folder) => {
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

/* =========================
   HTML GENERATION
   ========================= */
const htmlPlugins = Object.keys(entries)
    .map((name) => {
        const templatePath = path.join(pagesDir, name, `${name}.html`);
        if (fs.existsSync(templatePath)) {
            return new HtmlWebpackPlugin({
                template: templatePath,
                filename: `html/${name}.html`,
                chunks: [name],
                minify: isProduction,
            });
        }
        console.warn(`⚠️ No HTML template found for: ${name}`);
        return null;
    })
    .filter(Boolean);

/* =========================
   EXPORT
   ========================= */
module.exports = {
    entry: entries,

    output: {
        path: path.join(ROOT, "public"),
        publicPath: "/public/",
        clean: true,
    },

    resolve: {
        extensions: [".ts", ".tsx", ".js", ".mjs", ".jsx", ".json"],
        alias: {
            "@interfaces": path.join(ROOT, "src/interfaces"),
            "@components": path.join(ROOT, "src/components"),
            "@types": path.join(ROOT, "src/types"),
            "@utils": path.join(ROOT, "src/utils"),
            "@static": path.join(ROOT, "src/static"),
            "@models": path.join(ROOT, "src/models"),
            "@config": path.join(ROOT, "src/config"),
            "@core": path.join(ROOT, "src/core"),
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
                type: "asset/resource",
            },
            {
                test: /\.ts$/,
                loader: "esbuild-loader",
                options: {
                    loader: "ts",
                    target: "es2017",
                },
            },
            {
                test: /\.js$/,
                loader: "esbuild-loader",
                options: {
                    loader: "js",
                    target: "es2017",
                },
            },
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: "css-loader",
                        options: { sourceMap: false },
                    },
                ],
            },
        ],
    },

    plugins: [
        new MiniCssExtractPlugin({
            filename: "css/[name].css",
        }),
        new ForkTsCheckerWebpackPlugin({ async: true }),
        ...htmlPlugins,
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.join(ROOT, "src/static"),
                    to: path.join(ROOT, "public/static"),
                    noErrorOnMissing: true,
                },
                {
                    from: path.join(ROOT, "src/manifest.json"),
                    to: path.join(ROOT, "public/manifest.json"),
                },
                {
                    from: path.join(ROOT, "src/robots.txt"),
                    to: path.join(ROOT, "public/robots.txt"),
                    noErrorOnMissing: true,
                },
                {
                    from: path.join(ROOT, "src/google9d968a11b4bf61f7.html"),
                    to: path.join(ROOT, "public/google9d968a11b4bf61f7.html"),
                    noErrorOnMissing: true,
                },
            ],
        }),
    ],
};
