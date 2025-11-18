use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen_futures::JsFuture;
use web_sys::{Request, RequestInit, RequestMode, Response, Headers};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorefrontConfig {
    pub shop_domain: String,
    pub access_token: String,
    pub api_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLRequest {
    pub query: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLResponse {
    pub data: Option<serde_json::Value>,
    pub errors: Option<Vec<GraphQLError>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locations: Option<Vec<ErrorLocation>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorLocation {
    pub line: u32,
    pub column: u32,
}

#[wasm_bindgen]
pub struct StorefrontApi {
    config: StorefrontConfig,
}

#[wasm_bindgen]
impl StorefrontApi {
    #[wasm_bindgen(constructor)]
    pub fn new(shop_domain: String, access_token: String, api_version: String) -> StorefrontApi {
        console_log!("Initializing Storefront API client for: {}", shop_domain);
        StorefrontApi {
            config: StorefrontConfig {
                shop_domain,
                access_token,
                api_version,
            },
        }
    }

    #[wasm_bindgen]
    pub async fn query(&self, query: String, variables: Option<JsValue>) -> Result<JsValue, JsValue> {
        let variables_json = if let Some(vars) = variables {
            serde_wasm_bindgen::from_value(vars).unwrap_or(serde_json::Value::Null)
        } else {
            serde_json::Value::Null
        };

        let graphql_request = GraphQLRequest {
            query,
            variables: if variables_json.is_null() {
                None
            } else {
                Some(variables_json)
            },
        };

        let url = format!(
            "https://{}/api/{}/graphql.json",
            self.config.shop_domain, self.config.api_version
        );

        let mut opts = RequestInit::new();
        opts.method("POST");
        opts.mode(RequestMode::Cors);

        let headers = Headers::new().unwrap();
        headers.set("Content-Type", "application/json").unwrap();
        headers
            .set("X-Shopify-Storefront-Access-Token", &self.config.access_token)
            .unwrap();

        opts.headers(&headers);

        let body = serde_json::to_string(&graphql_request).unwrap();
        opts.body(Some(&JsValue::from_str(&body)));

        let request = Request::new_with_str_and_init(&url, &opts).unwrap();

        let window = web_sys::window().unwrap();
        let resp_value = JsFuture::from(window.fetch_with_request(&request)).await?;
        let resp: Response = resp_value.dyn_into().unwrap();

        let json = JsFuture::from(resp.json()?).await?;
        let response: GraphQLResponse = serde_wasm_bindgen::from_value(json).unwrap();

        if let Some(errors) = response.errors {
            let error_messages: Vec<String> = errors.iter().map(|e| e.message.clone()).collect();
            return Err(JsValue::from_str(&error_messages.join(", ")));
        }

        Ok(serde_wasm_bindgen::to_value(&response.data.unwrap_or(serde_json::Value::Null)).unwrap())
    }

    #[wasm_bindgen]
    pub async fn get_product(&self, handle: String) -> Result<JsValue, JsValue> {
        let query = r#"
            query getProduct($handle: String!) {
                product(handle: $handle) {
                    id
                    title
                    description
                    handle
                    vendor
                    productType
                    tags
                    priceRange {
                        minVariantPrice {
                            amount
                            currencyCode
                        }
                    }
                    images(first: 10) {
                        edges {
                            node {
                                id
                                url
                                altText
                                width
                                height
                            }
                        }
                    }
                    variants(first: 100) {
                        edges {
                            node {
                                id
                                title
                                price {
                                    amount
                                    currencyCode
                                }
                                availableForSale
                                selectedOptions {
                                    name
                                    value
                                }
                                image {
                                    url
                                    altText
                                }
                            }
                        }
                    }
                }
            }
        "#;

        let variables = serde_json::json!({
            "handle": handle
        });

        self.query(query.to_string(), Some(serde_wasm_bindgen::to_value(&variables).unwrap()))
            .await
    }

    #[wasm_bindgen]
    pub async fn get_collection(&self, handle: String, first: Option<u32>) -> Result<JsValue, JsValue> {
        let limit = first.unwrap_or(20);
        let query = format!(
            r#"
            query getCollection($handle: String!, $first: Int!) {{
                collection(handle: $handle) {{
                    id
                    title
                    description
                    handle
                    products(first: $first) {{
                        edges {{
                            node {{
                                id
                                title
                                handle
                                vendor
                                priceRange {{
                                    minVariantPrice {{
                                        amount
                                        currencyCode
                                    }}
                                }}
                                images(first: 1) {{
                                    edges {{
                                        node {{
                                            url
                                            altText
                                        }}
                                    }}
                                }}
                            }}
                        }}
                        pageInfo {{
                            hasNextPage
                            hasPreviousPage
                            startCursor
                            endCursor
                        }}
                    }}
                }}
            }}
        "#
        );

        let variables = serde_json::json!({
            "handle": handle,
            "first": limit
        });

        self.query(query, Some(serde_wasm_bindgen::to_value(&variables).unwrap()))
            .await
    }

    #[wasm_bindgen]
    pub async fn search_products(&self, query: String, first: Option<u32>) -> Result<JsValue, JsValue> {
        let limit = first.unwrap_or(20);
        let graphql_query = format!(
            r#"
            query searchProducts($query: String!, $first: Int!) {{
                products(first: $first, query: $query) {{
                    edges {{
                        node {{
                            id
                            title
                            handle
                            vendor
                            priceRange {{
                                minVariantPrice {{
                                    amount
                                    currencyCode
                                }}
                            }}
                            images(first: 1) {{
                                edges {{
                                    node {{
                                        url
                                        altText
                                    }}
                                }}
                            }}
                        }}
                    }}
                    pageInfo {{
                        hasNextPage
                        hasPreviousPage
                    }}
                }}
            }}
        "#
        );

        let variables = serde_json::json!({
            "query": query,
            "first": limit
        });

        self.query(graphql_query, Some(serde_wasm_bindgen::to_value(&variables).unwrap()))
            .await
    }

    #[wasm_bindgen]
    pub async fn create_cart(&self, items: JsValue) -> Result<JsValue, JsValue> {
        let cart_items: Vec<CartItem> = serde_wasm_bindgen::from_value(items).unwrap();
        
        let mut lines = String::new();
        for (i, item) in cart_items.iter().enumerate() {
            if i > 0 {
                lines.push_str(", ");
            }
            lines.push_str(&format!(
                r#"{{variantId: "{}", quantity: {}}}"#,
                item.variant_id, item.quantity
            ));
        }

        let query = format!(
            r#"
            mutation createCart($lines: [CartLineInput!]!) {{
                cartCreate(lines: $lines) {{
                    cart {{
                        id
                        checkoutUrl
                        totalQuantity
                        cost {{
                            totalAmount {{
                                amount
                                currencyCode
                            }}
                        }}
                        lines(first: 100) {{
                            edges {{
                                node {{
                                    id
                                    quantity
                                    merchandise {{
                                        ... on ProductVariant {{
                                            id
                                            title
                                            price {{
                                                amount
                                                currencyCode
                                            }}
                                            product {{
                                                title
                                                handle
                                            }}
                                        }}
                                    }}
                                }}
                            }}
                        }}
                    }}
                    userErrors {{
                        field
                        message
                    }}
                }}
            }}
        "#
        );

        let variables = serde_json::json!({
            "lines": cart_items.iter().map(|item| {
                serde_json::json!({
                    "variantId": item.variant_id,
                    "quantity": item.quantity
                })
            }).collect::<Vec<_>>()
        });

        self.query(query, Some(serde_wasm_bindgen::to_value(&variables).unwrap()))
            .await
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CartItem {
    pub variant_id: String,
    pub quantity: u32,
}

