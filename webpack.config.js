const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: {
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
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist/js'),
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: './src/sorttable.js', to: 'sorttable.js' },
                { from: './src/qrcode.min.js', to: 'qrcode.min.js' },
            ],
        }),
    ],
};
