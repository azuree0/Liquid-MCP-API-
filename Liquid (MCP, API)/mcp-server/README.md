# Storefront API MCP Server

Model Context Protocol (MCP) server for the Shopify Storefront API WebAssembly project. This server provides tools and resources that Cursor can use to interact with the project.

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

1. Copy the example config file:
```bash
cp .mcp-config.example.json .mcp-config.json
```

2. Edit `.mcp-config.json` with your Shopify credentials:
```json
{
  "shopDomain": "your-shop.myshopify.com",
  "accessToken": "your-storefront-api-access-token",
  "apiVersion": "2024-01"
}
```

Alternatively, set environment variables:
```bash
export STOREFRONT_SHOP_DOMAIN="your-shop.myshopify.com"
export STOREFRONT_ACCESS_TOKEN="your-token"
export STOREFRONT_API_VERSION="2024-01"
```

## Setting up in Cursor

1. Open Cursor Settings
2. Navigate to "Features" > "Model Context Protocol"
3. Add a new MCP server with:
   - **Name**: Storefront API
   - **Command**: `node`
   - **Args**: `["path/to/mcp-server/dist/index.js"]`
   - **Working Directory**: Project root

Or add to your Cursor settings JSON:
```json
{
  "mcpServers": {
    "storefront-api": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "cwd": "."
    }
  }
}
```

## Available Tools

### build_wasm
Build the WebAssembly module. Provides instructions for building.

### query_storefront_api
Execute a custom GraphQL query against Shopify Storefront API.

### get_product
Get product data by handle.

### get_collection
Get collection data with products.

### search_products
Search for products.

### read_rust_code
Read and analyze Rust source code from the WebAssembly module.

### read_js_wrapper
Read JavaScript wrapper files.

### check_build_status
Check if WebAssembly files are built and up to date.

## Development

```bash
# Build
npm run build

# Run in development mode
npm run dev

# Watch mode
npm run watch
```

## Resources

The MCP server exposes the following resources:
- Rust source code (`storefront-api-wasm/src/lib.rs`)
- JavaScript wrappers
- Cargo configuration

These can be accessed through Cursor's resource system.

