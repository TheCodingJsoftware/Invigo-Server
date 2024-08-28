const path = require('path');
const fs = require('fs');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const entries = {
    add_cutoff_sheet: './src/add_cutoff_sheet.js',
    index: './src/index.js',
    inventories: './src/inventories.js',
    inventory_table: './src/inventory_table.js',
    job_printouts: './src/job_printouts.js',
    logs: './src/logs.js',
    production_planner: './src/production_planner.js',
    sheet_template_read_only: './src/sheet_template_read_only.js',
    sheet_template: './src/sheet_template.js',
    view_qr_codes: './src/view_qr_codes.js',
    way_back_machine: './src/way_back_machine.js',
    workorder: './src/workorder.js',
    workspace_archives_dashboard: './src/workspace_archives_dashboard.js',
    workspace_dashboard: './src/workspace_dashboard.js',
    printout: './src/printout.js',
};

const htmlPlugins = Object.keys(entries).map(entryName => {
    const templatePath = path.resolve(__dirname, `./templates/${entryName}.html`);

    if (fs.existsSync(templatePath)) {
        return new HtmlWebpackPlugin({
            template: templatePath,
            filename: `html/${entryName}.html`,
            chunks: [entryName],
        });
    } else {
        console.warn(`Warning: Template for ${entryName} does not exist. Skipping...`);
        return null;
    }
}).filter(Boolean);

module.exports = {
    entry: entries,
    output: {
        filename: 'js/[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/dist/',
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
        ],
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: './src/sorttable.js', to: 'js/sorttable.js' },
                { from: './src/qrcode.min.js', to: 'js/qrcode.min.js' },
            ],
        }),
        new MiniCssExtractPlugin({
            filename: 'css/[name].bundle.css',
        }),
        ...htmlPlugins, // Include all the dynamically generated HtmlWebpackPlugin instances
    ],
};
