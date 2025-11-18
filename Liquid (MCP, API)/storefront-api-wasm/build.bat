@echo off
REM Build script for Storefront API WebAssembly module (Windows)

echo Building Storefront API WebAssembly module...

REM Check if wasm-pack is installed
where wasm-pack >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo wasm-pack is not installed. Installing...
    cargo install wasm-pack
)

REM Build the WebAssembly module
wasm-pack build --target web --out-dir ..\Liquid-main\assets\wasm --release

echo Build complete! WebAssembly module is in Liquid-main\assets\wasm\

