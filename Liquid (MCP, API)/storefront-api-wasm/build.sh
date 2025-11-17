#!/bin/bash

# Build script for Storefront API WebAssembly module

set -e

echo "Building Storefront API WebAssembly module..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack is not installed. Installing..."
    cargo install wasm-pack
fi

# Build the WebAssembly module
wasm-pack build --target web --out-dir ../Liquid-main/assets/wasm --release

echo "Build complete! WebAssembly module is in Liquid-main/assets/wasm/"

