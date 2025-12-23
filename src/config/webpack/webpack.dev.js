const { merge } = require("webpack-merge");
const common = require("./webpack.common");

const path = require("path");
const ROOT = process.cwd();

module.exports = merge(common, {
    mode: "development",

    devtool: "source-map",

    output: {
        filename: "js/[name].bundle.js"
    },

    devServer: {
        static: {
            directory: path.join(ROOT, "public")
        },
        hot: true,
        open: true,
        historyApiFallback: true,
        client: { overlay: true }
    },

    optimization: {
        minimize: false
    }
});
