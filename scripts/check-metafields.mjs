// Query metafield definitions for Products
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envFile = readFileSync(envPath, 'utf8');
for (const line of envFile.split(/\r?\n/)) {
  const match = line.match(/^([^=#]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const SHOP = process.env.SHOPIFY_STORE;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-01';

async function getToken() {
  const resp = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  return (await resp.json()).access_token;
}

async function main() {
  const token = await getToken();
  
  // Get metafield definitions for Products
  const query = `{
    metafieldDefinitions(ownerType: PRODUCT, first: 50) {
      edges {
        node {
          id
          name
          namespace
          key
          type { name }
          description
          pinnedPosition
          validations { name value }
        }
      }
    }
  }`;
  
  const resp = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  
  const json = await resp.json();
  if (json.errors) {
    console.error('Errors:', JSON.stringify(json.errors, null, 2));
    return;
  }
  
  const defs = json.data?.metafieldDefinitions?.edges?.map(e => e.node) || [];
  console.log(`Found ${defs.length} metafield definitions for Products:\n`);
  for (const d of defs) {
    console.log(`  Name: ${d.name}`);
    console.log(`  Namespace: ${d.namespace}`);
    console.log(`  Key: ${d.key}`);
    console.log(`  Type: ${d.type?.name}`);
    console.log(`  Description: ${d.description || '(none)'}`);
    console.log(`  ---`);
  }
  
  // Also check a product to see if any have metafield values
  const prodQuery = `{
    products(first: 3) {
      edges {
        node {
          id title
          metafields(first: 20) {
            edges {
              node {
                namespace key value type
              }
            }
          }
        }
      }
    }
  }`;
  
  const prodResp = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: prodQuery }),
  });
  
  const prodJson = await prodResp.json();
  const products = prodJson.data?.products?.edges?.map(e => e.node) || [];
  console.log(`\n\nSample products with metafield values:`);
  for (const p of products) {
    const mfs = p.metafields?.edges?.map(e => e.node) || [];
    console.log(`\n  ${p.title} (${mfs.length} metafields)`);
    for (const m of mfs) {
      console.log(`    ${m.namespace}.${m.key} = "${m.value}" (${m.type})`);
    }
  }
}

main().catch(e => console.error(e.message));
