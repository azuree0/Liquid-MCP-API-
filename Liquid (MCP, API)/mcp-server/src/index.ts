#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StorefrontApiConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

class StorefrontApiMcpServer {
  private server: Server;
  private config: StorefrontApiConfig | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'storefront-api-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'build_wasm',
          description: 'Build the WebAssembly module for Storefront API',
          inputSchema: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                enum: ['web'],
                description: 'Build target (currently only "web" is supported)',
                default: 'web',
              },
            },
          },
        },
        {
          name: 'query_storefront_api',
          description: 'Execute a GraphQL query against Shopify Storefront API',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'GraphQL query string',
              },
              variables: {
                type: 'object',
                description: 'Optional GraphQL variables',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_product',
          description: 'Get product data by handle using Storefront API',
          inputSchema: {
            type: 'object',
            properties: {
              handle: {
                type: 'string',
                description: 'Product handle',
              },
            },
            required: ['handle'],
          },
        },
        {
          name: 'get_collection',
          description: 'Get collection data by handle using Storefront API',
          inputSchema: {
            type: 'object',
            properties: {
              handle: {
                type: 'string',
                description: 'Collection handle',
              },
              first: {
                type: 'number',
                description: 'Number of products to fetch',
                default: 20,
              },
            },
            required: ['handle'],
          },
        },
        {
          name: 'search_products',
          description: 'Search products using Storefront API',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              first: {
                type: 'number',
                description: 'Number of results',
                default: 20,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'read_rust_code',
          description: 'Read and analyze Rust source code from the WebAssembly module',
          inputSchema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                description: 'File path relative to storefront-api-wasm/src/',
                default: 'lib.rs',
              },
            },
          },
        },
        {
          name: 'read_js_wrapper',
          description: 'Read JavaScript wrapper code',
          inputSchema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                enum: ['storefront-api.js', 'storefront-api-integration.js'],
                description: 'JavaScript wrapper file to read',
              },
            },
            required: ['file'],
          },
        },
        {
          name: 'check_build_status',
          description: 'Check if WebAssembly files are built and up to date',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'build_wasm':
            return await this.buildWasm(args?.target || 'web');

          case 'query_storefront_api':
            return await this.queryStorefrontApi(
              args?.query,
              args?.variables
            );

          case 'get_product':
            return await this.getProduct(args?.handle);

          case 'get_collection':
            return await this.getCollection(args?.handle, args?.first);

          case 'search_products':
            return await this.searchProducts(args?.query, args?.first);

          case 'read_rust_code':
            return await this.readRustCode(args?.file || 'lib.rs');

          case 'read_js_wrapper':
            return await this.readJsWrapper(args?.file);

          case 'check_build_status':
            return await this.checkBuildStatus();

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'file://storefront-api-wasm/src/lib.rs',
          name: 'Rust Source Code',
          description: 'Main Rust implementation for Storefront API',
          mimeType: 'text/x-rust',
        },
        {
          uri: 'file://Liquid-main/assets/storefront-api.js',
          name: 'JavaScript Wrapper',
          description: 'JavaScript wrapper for WebAssembly module',
          mimeType: 'application/javascript',
        },
        {
          uri: 'file://Liquid-main/assets/storefront-api-integration.js',
          name: 'Integration Helper',
          description: 'High-level integration helper',
          mimeType: 'application/javascript',
        },
        {
          uri: 'file://storefront-api-wasm/Cargo.toml',
          name: 'Cargo Configuration',
          description: 'Rust dependencies and build configuration',
          mimeType: 'text/x-toml',
        },
      ],
    }));

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const filePath = uri.replace('file://', '');

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          contents: [
            {
              uri,
              mimeType: this.getMimeType(filePath),
              text: content,
            },
          ],
        };
      } catch (error: any) {
        throw new Error(`Failed to read resource: ${error.message}`);
      }
    });
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      '.rs': 'text/x-rust',
      '.js': 'application/javascript',
      '.toml': 'text/x-toml',
      '.md': 'text/markdown',
      '.json': 'application/json',
    };
    return mimeTypes[ext] || 'text/plain';
  }

  private async buildWasm(target: string): Promise<any> {
    const wasmDir = path.join(__dirname, '../../storefront-api-wasm');
    const buildScript = process.platform === 'win32' ? 'build.bat' : 'build.sh';

    return {
      content: [
        {
          type: 'text',
          text: `To build the WebAssembly module, run:
          
cd storefront-api-wasm
${process.platform === 'win32' ? 'build.bat' : './build.sh'}

Or manually:
wasm-pack build --target ${target} --out-dir ../Liquid-main/assets/wasm --release

The build will create files in Liquid-main/assets/wasm/`,
        },
      ],
    };
  }

  private async queryStorefrontApi(
    query?: string,
    variables?: any
  ): Promise<any> {
    if (!query) {
      throw new Error('GraphQL query is required');
    }

    // Load config if available
    const config = this.loadConfig();
    if (!config) {
      return {
        content: [
          {
            type: 'text',
            text: 'Storefront API configuration not found. Please set up your access token first.',
          },
        ],
      };
    }

    try {
      const response = await fetch(
        `https://${config.shopDomain}/api/${config.apiVersion}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': config.accessToken,
          },
          body: JSON.stringify({
            query,
            variables: variables || {},
          }),
        }
      );

      const data = await response.json();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  private async getProduct(handle?: string): Promise<any> {
    if (!handle) {
      throw new Error('Product handle is required');
    }

    const query = `
      query getProduct($handle: String!) {
        product(handle: $handle) {
          id
          title
          description
          handle
          vendor
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 10) {
            edges {
              node {
                url
                altText
              }
            }
          }
        }
      }
    `;

    return this.queryStorefrontApi(query, { handle });
  }

  private async getCollection(
    handle?: string,
    first: number = 20
  ): Promise<any> {
    if (!handle) {
      throw new Error('Collection handle is required');
    }

    const query = `
      query getCollection($handle: String!, $first: Int!) {
        collection(handle: $handle) {
          id
          title
          description
          products(first: $first) {
            edges {
              node {
                id
                title
                handle
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    `;

    return this.queryStorefrontApi(query, { handle, first });
  }

  private async searchProducts(
    query?: string,
    first: number = 20
  ): Promise<any> {
    if (!query) {
      throw new Error('Search query is required');
    }

    const graphqlQuery = `
      query searchProducts($query: String!, $first: Int!) {
        products(first: $first, query: $query) {
          edges {
            node {
              id
              title
              handle
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    return this.queryStorefrontApi(graphqlQuery, { query, first });
  }

  private async readRustCode(file: string): Promise<any> {
    const filePath = path.join(
      __dirname,
      '../../storefront-api-wasm/src',
      file
    );

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: `# ${file}\n\n\`\`\`rust\n${content}\n\`\`\``,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to read Rust file: ${error.message}`);
    }
  }

  private async readJsWrapper(file: string): Promise<any> {
    const filePath = path.join(__dirname, '../../Liquid-main/assets', file);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: `# ${file}\n\n\`\`\`javascript\n${content}\n\`\`\``,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to read JavaScript file: ${error.message}`);
    }
  }

  private async checkBuildStatus(): Promise<any> {
    const wasmDir = path.join(__dirname, '../../Liquid-main/assets/wasm');
    const expectedFiles = [
      'storefront_api_wasm.js',
      'storefront_api_wasm_bg.wasm',
    ];

    const status: any = {
      built: false,
      files: [],
      missing: [],
    };

    if (fs.existsSync(wasmDir)) {
      const files = fs.readdirSync(wasmDir);
      status.files = files;

      for (const expected of expectedFiles) {
        if (files.includes(expected)) {
          const filePath = path.join(wasmDir, expected);
          const stats = fs.statSync(filePath);
          status[expected] = {
            exists: true,
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        } else {
          status.missing.push(expected);
        }
      }

      status.built = status.missing.length === 0;
    } else {
      status.built = false;
      status.missing = expectedFiles;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }

  private loadConfig(): StorefrontApiConfig | null {
    // Try to load config from environment or config file
    const configPath = path.join(__dirname, '../../.mcp-config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return config as StorefrontApiConfig;
      } catch (error) {
        // Ignore
      }
    }

    // Try environment variables
    if (
      process.env.STOREFRONT_SHOP_DOMAIN &&
      process.env.STOREFRONT_ACCESS_TOKEN
    ) {
      return {
        shopDomain: process.env.STOREFRONT_SHOP_DOMAIN,
        accessToken: process.env.STOREFRONT_ACCESS_TOKEN,
        apiVersion: process.env.STOREFRONT_API_VERSION || '2024-01',
      };
    }

    return null;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Storefront API MCP server running on stdio');
  }
}

const server = new StorefrontApiMcpServer();
server.run().catch(console.error);

