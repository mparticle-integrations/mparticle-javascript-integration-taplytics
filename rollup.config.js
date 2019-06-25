import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default [{
    input: 'src/TaplyticsKit.js',
    output: {
        file: 'TaplyticsKit.js',
       format: 'umd',
        exports: 'named',
        name: 'mp-taplytics-kit',
        strict: false
    },
    plugins: [
        resolve({
            browser: true
        }),
        commonjs()
    ]
},
{
    input: 'src/TaplyticsKit.js',
    output: {
        file: 'dist/TaplyticsKit.js',
        format: 'umd',
        exports: 'named',
        name: 'mp-taplytics-kit',
        strict: false
    },
    plugins: [
        resolve({
            browser: true
        }),
        commonjs()
    ]
}
] 