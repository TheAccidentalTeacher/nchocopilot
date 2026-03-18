// Quick script to find Shopify taxonomy GIDs
// Run: npx tsx scripts/check-taxonomy.mjs

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local manually
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
  const data = await resp.json();
  return data.access_token;
}

async function main() {
  const token = await getToken();
  
  // Get all categories including children - need to paginate through ALL levels
  const allCats = [];
  let cursor = null;
  let page = 0;
  
  while (true) {
    page++;
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    // Use level to get deeper categories
    const query = `{ 
      taxonomy { 
        categories(first: 250${afterClause}) { 
          edges { 
            cursor 
            node { 
              id 
              name 
              fullName 
              isLeaf
              level
              childrenIds
            } 
          } 
          pageInfo { hasNextPage } 
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
      console.error('GraphQL errors:', JSON.stringify(json.errors));
      break;
    }
    
    const edges = json.data?.taxonomy?.categories?.edges || [];
    console.log(`Page ${page}: got ${edges.length} categories`);
    for (const e of edges) {
      allCats.push(e.node);
      cursor = e.cursor;
    }
    
    if (!json.data?.taxonomy?.categories?.pageInfo?.hasNextPage) break;
  }
  
  console.log(`\nTotal categories: ${allCats.length}`);
  
  // Show top-level categories with their IDs  
  console.log('\nAll categories:');
  for (const c of allCats) {
    const children = c.childrenIds?.length || 0;
    console.log(`  ${c.id} | L${c.level} | ${c.fullName || c.name} | ${c.isLeaf ? 'LEAF' : `${children} children`}`);
  }
  
  // Now try to look up specific sub-categories for Books, Puzzles, Board Games, Science Kits
  const mediaId = allCats.find(c => c.name === 'Media')?.id;
  const toysId = allCats.find(c => c.name === 'Toys & Games')?.id;
  
  if (mediaId) {
    console.log('\n--- Drilling into Media ---');
    await drillDown(token, mediaId, 0);
  }
  if (toysId) {
    console.log('\n--- Drilling into Toys & Games ---');
    await drillDown(token, toysId, 0);
  }
}

async function drillDown(token, parentId, depth) {
  if (depth > 4) return;
  const query = `{
    taxonomy {
      categories(first: 50, childrenOf: "${parentId}") {
        edges { node { id name fullName isLeaf childrenIds level } }
      }
    }
  }`;
  const resp = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await resp.json();
  if (json.errors) { console.error('  drill error:', json.errors[0]?.message); return; }
  const children = json.data?.taxonomy?.categories?.edges?.map(e => e.node) || [];
  const indent = '  '.repeat(depth + 1);
  for (const c of children) {
    const kw = ['book','puzzle','board game','game','science','educational','kit','learning'];
    const isRelevant = kw.some(k => (c.fullName || c.name).toLowerCase().includes(k));
    const marker = isRelevant ? ' <<<' : '';
    console.log(`${indent}${c.id} | ${c.name}${c.isLeaf ? ' [LEAF]' : ''}${marker}`);
    // Drill deeper into relevant branches
    if (!c.isLeaf && (isRelevant || depth < 1)) {
      await drillDown(token, c.id, depth + 1);
    }
  }
}

main().catch(e => console.error(e.message));
