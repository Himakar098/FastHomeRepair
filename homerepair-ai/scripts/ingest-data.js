#!/usr/bin/env node
/*
 * scripts/ingest-data.js
 *
 * This script demonstrates how to fetch realâ€‘time product and
 * professional data from public Australian websites and transform it
 * into a format suitable for ingestion into the FastHomeRepair search
 * index and Cosmos DB database.  Running this script will attempt to
 * scrape product listings from the Bunnings website and search for
 * local professionals using simple web scraping.  The results are
 * written to JSON files in the project directory.
 *
 * NOTE: Web scraping should respect the target site's robots.txt and
 * terms of service.  This example uses publicly available pages for
 * demonstration.  For production use you should obtain data via
 * official APIs or data feeds where possible.  Additionally, network
 * access may be restricted in some environments; if requests fail,
 * the script will log a warning and continue with whatever data it
 * collects.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs/promises');

/**
 * Fetch a list of products from the Bunnings search page.  The
 * function searches for a keyword, parses the HTML, and returns an
 * array of product objects with id, name, price, supplier, link,
 * imageUrl and other metadata.  Bunnings does not offer a public API
 * for product search, so this function scrapes the search results.
 *
 * @param {string} query The search keyword (e.g. "oven cleaner").
 * @returns {Promise<Array>} An array of product objects.
 */
async function fetchBunningsProducts(query) {
  const products = [];
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.bunnings.com.au/search/products?q=${encodedQuery}`;
  try {
    const { data } = await axios.get(url, {
      headers: {
        // Spoof a browser Userâ€‘Agent to avoid bot blocking
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36'
      },
      timeout: 15000
    });
    const $ = cheerio.load(data);
    // Each product tile lives in a list item with dataâ€‘sku attribute
    $('.product-list__item').each((_, el) => {
      const $el = $(el);
      const id = $el.attr('data-sku') || null;
      const name = $el.find('.product-title').text().trim();
      // Bunnings often formats price as "$12" or "$12.50"; strip dollar sign
      const priceText = $el.find('.product-price__price').text().trim();
      let price = null;
      const match = priceText.match(/\$([\d,.]+)/);
      if (match) {
        price = parseFloat(match[1].replace(/,/g, ''));
      }
      const linkRel = $el.find('a.product-title-link').attr('href') || null;
      const link = linkRel ? `https://www.bunnings.com.au${linkRel}` : null;
      const imageUrl = $el.find('.product-image img').attr('src') || null;
      if (name) {
        products.push({
          id: id || name,
          name,
          category: null,
          price,
          supplier: 'Bunnings',
          location: null,
          state: null,
          postcode: null,
          problems: [],
          rating: null,
          link,
          imageUrl,
          lastUpdated: new Date().toISOString()
        });
      }
    });
  } catch (err) {
    console.warn(`Failed to fetch products from Bunnings for query "${query}":`, err.message);
  }
  return products;
}

/**
 * Fetch a list of local professionals by querying a search engine.
 * Because there is no free API for Australian trade directories, this
 * function performs a simple DuckDuckGo search and extracts the top
 * results.  The returned items contain a name, link and placeholder
 * phone number and rating.  In a real application you would use
 * official APIs (e.g. Yellow Pages or Google Business) to obtain
 * structured data.
 *
 * @param {string} service The service type (e.g. "plumber", "electrician").
 * @param {string} location A city or suburb (e.g. "Brisbane").
 * @returns {Promise<Array>} Array of professional objects.
 */
async function fetchProfessionals(service, location) {
  const professionals = [];
  const query = encodeURIComponent(`${service} ${location} site:hipages.com.au`);
  const url = `https://duckduckgo.com/html/?q=${query}`;
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36'
      },
      timeout: 15000
    });
    const $ = cheerio.load(data);
    $('a.result__a').each((i, el) => {
      if (i >= 5) return false; // limit to first 5 results
      const link = $(el).attr('href');
      const name = $(el).text().trim();
      professionals.push({
        id: `${service}-${location}-${i}`,
        name,
        services: [service],
        serviceAreas: [location],
        phone: null,
        website: link,
        rating: null,
        state: null
      });
    });
  } catch (err) {
    console.warn(`Failed to fetch professionals for service "${service}" in location "${location}":`, err.message);
  }
  return professionals;
}

async function main() {
  const productKeywords = [
    'oven cleaner',
    'bench top repair kit',
    'wall filler',
    'tile adhesive'
  ];
  const allProducts = [];
  for (const kw of productKeywords) {
    const items = await fetchBunningsProducts(kw);
    allProducts.push(...items);
  }
  // Deduplicate by id
  const uniqueProducts = Array.from(
    new Map(allProducts.map((p) => [p.id, p])).values()
  );
  await fs.writeFile('products.scraped.json', JSON.stringify(uniqueProducts, null, 2));
  console.log(`Wrote ${uniqueProducts.length} products to products.scraped.json`);

  // Fetch professionals for a few services in Brisbane as an example
  const services = ['plumber', 'electrician', 'carpenter'];
  const location = 'Brisbane';
  const allPros = [];
  for (const svc of services) {
    const pros = await fetchProfessionals(svc, location);
    allPros.push(...pros);
  }
  await fs.writeFile('professionals.scraped.json', JSON.stringify(allPros, null, 2));
  console.log(`Wrote ${allPros.length} professionals to professionals.scraped.json`);
}

// Execute if run as a script
if (require.main === module) {
  main().catch((err) => console.error(err));
}