![l](https://github.com/user-attachments/assets/232547e4-0a77-48b3-b443-903a105d44bf)

### Project Structure

```
storefront-api-wasm/
├── src/
│   └── lib.rs          # Main Rust code
├── Cargo.toml          # Rust dependencies
├── build.sh            # Build script (Linux/macOS)
├── build.bat           # Build script (Windows)
└── .cargo/
    └── config.toml     # Rust compiler configuration

Liquid-main/assets/
├── storefront-api.js              # WebAssembly wrapper client
├── storefront-api-integration.js  # High-level integration helper
└── wasm/                           # Compiled WebAssembly files
    ├── storefront_api_wasm.js
    ├── storefront_api_wasm_bg.wasm
    └── ...

mcp-server/
├── src/
│   └── index.ts        # MCP server implementation
├── package.json        # Node.js dependencies
├── tsconfig.json       # TypeScript configuration
└── README.md           # MCP server documentation
```

## MCP (Model Context Protocol) Setup for Cursor

1. **Install MCP Server Dependencies:**
```bash
cd mcp-server
npm install
npm run build
```

2. **Configure MCP Server:**
```bash
cp mcp-server/.mcp-config.example.json .mcp-config.json
# Edit .mcp-config.json with your Shopify credentials
```

3. **Add to Cursor Settings:**
   - Open Cursor Settings
   - Navigate to "Features" > "Model Context Protocol"
   - Add server:
     - **Name**: Storefront API
     - **Command**: `node`
     - **Args**: `["./mcp-server/dist/index.js"]`
     - **Working Directory**: Project root

### Available MCP Tools

- `build_wasm` - Build the WebAssembly module
- `query_storefront_api` - Execute GraphQL queries
- `get_product` - Get product data by handle
- `get_collection` - Get collection data
- `search_products` - Search products
- `read_rust_code` - Read Rust source files
- `read_js_wrapper` - Read JavaScript wrapper files
- `check_build_status` - Check if WASM files are built



## Storefront API WebAssembly Module

### 1. Install Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
cargo install wasm-pack

# Add WebAssembly target
rustup target add wasm32-unknown-unknown
```

### 2. Build the WebAssembly Module

**Windows:**
```cmd
cd storefront-api-wasm
build.bat
```

**Linux/macOS:**
```bash
cd storefront-api-wasm
chmod +x build.sh
./build.sh
```

**Manual Build:**
```bash
cd storefront-api-wasm
wasm-pack build --target web --out-dir ../Liquid-main/assets/wasm --release
```

This will create the WebAssembly files in `Liquid-main/assets/wasm/`:
- `storefront_api_wasm.js` - JavaScript bindings
- `storefront_api_wasm_bg.wasm` - Compiled WebAssembly binary
- Other supporting files

### 3. Get Your Storefront API Token

1. Log in to your Shopify admin
2. Go to **Settings** > **Apps and sales channels**
3. Click **Develop apps**
4. Create a new app or select an existing one
5. Click **Configure Storefront API scopes**
6. Under **Storefront API**, select the scopes you need:
   - `unauthenticated_read_product_listings` (for public product data)
   - `unauthenticated_read_checkouts` (for cart operations)
   - `unauthenticated_write_checkouts` (for cart operations)
7. Click **Save**
8. Go to **API credentials** tab
9. Under **Storefront API access token**, click **Install app** if needed
10. Copy your **Storefront API access token**

⚠️ **Security Warning**: Never commit your access token to version control. Use environment variables or Shopify theme settings.

### 4. Add to Your Theme

In `layout/theme.liquid`, before the closing `</body>` tag:

```liquid
<script src="{{ 'storefront-api.js' | asset_url }}" defer></script>
<script src="{{ 'storefront-api-integration.js' | asset_url }}" defer></script>

<script type="module">
  const apiIntegration = new StorefrontApiIntegration();
  
  // Get token from theme settings or environment
  // IMPORTANT: In production, use a secure method to store this token
  const accessToken = 'YOUR_STOREFRONT_API_ACCESS_TOKEN';
  
  if (accessToken && accessToken !== 'YOUR_STOREFRONT_API_ACCESS_TOKEN') {
    await apiIntegration.init(accessToken);
    window.storefrontApi = apiIntegration; // Make available globally
  }
</script>
```

### 5. Use It

```javascript
// Fetch a product
const product = await window.storefrontApi.fetchProduct('product-handle');

// Fetch a collection
const collection = await window.storefrontApi.fetchCollection('collection-handle', 20);

// Search products
const results = await window.storefrontApi.searchProducts('search term', 10);

// Create a cart
const cart = await window.storefrontApi.createCart([
  {
    variantId: 'gid://shopify/ProductVariant/123456789',
    quantity: 1
  }
]);
```
