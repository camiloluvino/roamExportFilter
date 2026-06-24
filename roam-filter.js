// Roam Filter Export - Smart Export for Filtered Blocks
// Version: 2.35.1
// Date: 2026-06-24 13:45
//
// Created by Camilo Luvino
// https://github.com/camiloluvino/roamExportFilter
//
// Exports content filtered by tags using Datalog queries.
// Works even when blocks are collapsed (unlike DOM-based approaches).

// ============================================
// JSZIP LOADING (for ZIP exports when >5 files)
// ============================================

// Load JSZip from CDN if not already loaded
const loadJSZip = () => {
  return new Promise((resolve, reject) => {
    if (window.JSZip) {
      resolve(window.JSZip);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error('Failed to load JSZip'));
    document.head.appendChild(script);
  });
};


// ============================================
// INLINE MODULES (Roam doesn't support ES modules)
// ============================================

// --- queries.js ---
const isRoamAPIAvailable = () => {
  return typeof window !== 'undefined' &&
    window.roamAlphaAPI &&
    typeof window.roamAlphaAPI.data?.q === 'function';
};

// Escape double quotes in strings interpolated into Datalog queries
const escapeDatalogString = (str) => {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

// Get the UID of the currently open page
const getCurrentPageUid = () => {
  // Try to get from URL hash (works for both page and daily notes)
  const match = window.location.hash.match(/\/page\/(.+?)(?:\/|$)/);
  if (match) {
    return match[1];
  }

  // For daily notes page, get from URL with date format
  const dailyMatch = window.location.hash.match(/\/(\d{2}-\d{2}-\d{4})(?:\/|$)/);
  if (dailyMatch) {
    // Convert date to Roam's daily page title format
    const dateStr = dailyMatch[1];
    const [month, day, year] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    const roamDateTitle = date.toLocaleDateString('en-US', options);

    // Get the page UID for this date title
    const result = window.roamAlphaAPI.data.q(`
      [:find ?uid .
       :where
       [?page :node/title "${escapeDatalogString(roamDateTitle)}"]
       [?page :block/uid ?uid]]
    `);
    return result || null;
  }

  // Fallback for daily notes view (URL has no /page/ — just #/app/{graph-name})
  // When on the main view, Roam shows today's daily note
  const appMatch = window.location.hash.match(/^#\/app\/[^/]+\/?$/);
  if (appMatch) {
    const today = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const d = today.getDate();
    const suffix = (d % 10 === 1 && d !== 11) ? 'st'
      : (d % 10 === 2 && d !== 12) ? 'nd'
        : (d % 10 === 3 && d !== 13) ? 'rd' : 'th';
    const roamDateTitle = `${months[today.getMonth()]} ${d}${suffix}, ${today.getFullYear()}`;
    const result = window.roamAlphaAPI.data.q(`
      [:find ?uid .
       :where
       [?page :node/title "${escapeDatalogString(roamDateTitle)}"]
       [?page :block/uid ?uid]]
    `);
    if (DEBUG) console.log('Daily notes fallback — looking for:', roamDateTitle, '→ uid:', result);
    return result || null;
  }

  return null;
};

const findBlocksByTag = (tagName, targetPageUid = null) => {
  if (!isRoamAPIAvailable()) {
    console.error("Roam API is not available");
    return [];
  }

  const pageUid = targetPageUid || getCurrentPageUid();
  if (!pageUid) {
    console.error("Could not determine current page UID");
    return [];
  }

  if (DEBUG) console.log(`Searching for #${tagName} in page ${pageUid}`);

  try {
    // Find blocks that reference the tag AND belong to the current page
    // :block/page is the page entity where the block lives
    // Include :block/order to maintain correct sorting
    const results = window.roamAlphaAPI.data.q(`
      [:find (pull ?block [:block/uid :block/string :block/order :block/heading
                           {:block/parents [:block/uid :block/string :block/order :block/heading]}])
       :where
       [?tag :node/title "${escapeDatalogString(tagName)}"]
       [?block :block/refs ?tag]
       [?block :block/page ?page]
       [?page :block/uid "${escapeDatalogString(pageUid)}"]]
    `);

    if (!results || results.length === 0) {
      if (DEBUG) console.log(`No blocks found with #${tagName} in page ${pageUid}`);
      return [];
    }

    if (DEBUG) console.log(`Found ${results.length} blocks with #${tagName} in current page`);

    return results.map(r => r[0]).filter(Boolean);
  } catch (err) {
    console.error("Error in findBlocksByTag:", err);
    return [];
  }
};

// Get child pages under a namespace (e.g., "entrevista/real" finds "entrevista/real/María Paz")
const getChildPages = (pageName) => {
  if (!isRoamAPIAvailable() || !pageName) {
    return [];
  }

  try {
    // Find all pages whose title starts with "pageName/"
    const prefix = `${pageName}/`;
    const results = window.roamAlphaAPI.data.q(`
      [:find ?title ?uid
       :where
       [?page :node/title ?title]
       [?page :block/uid ?uid]]
    `);

    if (!results || results.length === 0) {
      return [];
    }

    // Filter in JavaScript (more reliable than clojure.string/starts-with?)
    const childPages = results
      .filter(r => r[0] && r[0].startsWith(prefix))
      // Only direct children (no deeper nesting like entrevista/real/X/Y)
      .filter(r => !r[0].substring(prefix.length).includes('/'))
      .map(r => ({
        title: r[0],
        uid: r[1],
        shortName: r[0].substring(prefix.length)
      }))
      .sort((a, b) => a.shortName.localeCompare(b.shortName));

    if (DEBUG) console.log(`Found ${childPages.length} child pages under "${pageName}"`, childPages);
    return childPages;
  } catch (err) {
    console.error('Error in getChildPages:', err);
    return [];
  }
};

// Search pages by partial title match (for "Por Páginas" tab)
const searchPages = (searchTerm) => {
  if (!isRoamAPIAvailable() || !searchTerm || searchTerm.length < 2) {
    return [];
  }

  try {
    const results = window.roamAlphaAPI.data.q(`
      [:find ?title ?uid
       :where
       [?page :node/title ?title]
       [?page :block/uid ?uid]]
    `);

    if (!results || results.length === 0) return [];

    const term = searchTerm.toLowerCase();
    return results
      .filter(r => r[0] && r[0].toLowerCase().includes(term))
      // Exclude daily notes (e.g., "February 20th, 2026") and system pages
      .filter(r => !r[0].match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s\d/))
      .filter(r => !r[0].startsWith('roam/'))
      .map(r => ({
        title: r[0],
        uid: r[1],
        shortName: r[0]
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 50);
  } catch (err) {
    console.error('Error in searchPages:', err);
    return [];
  }
};

const getBlockWithDescendants = (blockUid) => {
  if (!isRoamAPIAvailable() || !blockUid) {
    if (DEBUG) console.log(`getBlockWithDescendants: invalid input, blockUid=${blockUid}`);
    return null;
  }

  try {
    const result = window.roamAlphaAPI.pull(
      `[:block/uid :block/string :block/order :block/heading {:block/children [:block/uid :block/order]}]`,
      [":block/uid", blockUid]
    );

    if (DEBUG) console.log(`getBlockWithDescendants raw result for ${blockUid}:`, result);

    if (!result) return null;

    // Build tree with manual recursion for children
    return buildTreeRecursively(result);
  } catch (err) {
    console.error("Error in getBlockWithDescendants:", err);
    return null;
  }
};

// Manually recurse to build complete tree
const buildTreeRecursively = (block) => {
  if (!block) return null;

  const uid = block[":block/uid"] || block.uid;
  const content = block[":block/string"] || block.string || "";
  const heading = block[":block/heading"] || block.heading || 0;
  const children = block[":block/children"] || block.children || [];

  const node = {
    uid,
    content,
    heading,
    children: []
  };

  if (children.length > 0) {
    // Sort by order
    const sortedChildren = [...children].sort((a, b) => {
      const orderA = a[":block/order"] || a.order || 0;
      const orderB = b[":block/order"] || b.order || 0;
      return orderA - orderB;
    });

    // Fetch each child's full data and recurse
    for (const child of sortedChildren) {
      const childUid = child[":block/uid"] || child.uid;
      if (childUid) {
        const childData = window.roamAlphaAPI.pull(
          `[:block/uid :block/string :block/order :block/heading {:block/children [:block/uid :block/order]}]`,
          [":block/uid", childUid]
        );
        if (childData) {
          const childNode = buildTreeRecursively(childData);
          if (childNode) {
            node.children.push(childNode);
          }
        }
      }
    }
  }

  return node;
};

// Check if a tree node's content references a tag (by [[tag]], #tag, or tag::)
const contentContainsTag = (content, tagName) => {
  if (!content || !tagName) return false;
  // Match [[tagName]], #tagName (word boundary), or tagName:: (attribute)
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `\\[\\[${escaped}\\]\\]|#${escaped}(?:\\b|$)|${escaped}::`,
    'i'
  );
  return regex.test(content);
};

// Check if a tree node or any of its descendants contains the tag
const treeContainsTag = (node, tagName) => {
  if (!node) return false;
  if (contentContainsTag(node.content, tagName)) return true;
  if (node.children && node.children.length > 0) {
    return node.children.some(child => treeContainsTag(child, tagName));
  }
  return false;
};

/**
 * Filter a branch tree to keep only children (sub-branches) that contain the tag.
 * The root node (branch header) is always kept; its children are pruned.
 * If a child doesn't directly have the tag but one of its descendants does,
 * the child is kept as a path to the tag.
 *
 * @param {Object} tree - The block node tree to filter
 * @param {string} tagName - The tag to filter by
 * @returns {Object|null} The filtered tree, or null if it should be removed entirely
 */
const filterTreeByTag = (tree, tagName) => {
  if (!tree || !tagName) return tree;

  // If the root itself has the tag, return the whole tree
  if (contentContainsTag(tree.content, tagName)) return tree;

  // Filter children: keep only those that contain the tag somewhere in their subtree
  if (tree.children && tree.children.length > 0) {
    tree.children = tree.children.filter(child => treeContainsTag(child, tagName));
  }

  return tree;
};

const transformBlock = (block) => {
  if (!block) return null;

  // Handle both prefixed (:block/uid) and non-prefixed (uid) attribute names
  const uid = block[":block/uid"] || block.uid;
  const content = block[":block/string"] || block.string || "";
  const children = block[":block/children"] || block.children || [];
  const order = block[":block/order"] || block.order || 0;

  const node = {
    uid,
    content,
    children: []
  };

  if (children.length > 0) {
    const sortedChildren = [...children]
      .sort((a, b) => {
        const orderA = a[":block/order"] || a.order || 0;
        const orderB = b[":block/order"] || b.order || 0;
        return orderA - orderB;
      });

    node.children = sortedChildren
      .map(child => transformBlock(child))
      .filter(Boolean);
  }

  return node;
};

// --- export-by-root.js ---
// Get all root-level blocks (direct children of the page)
const getRootBlocks = (pageUid) => {
  if (!isRoamAPIAvailable() || !pageUid) {
    console.error("getRootBlocks: invalid input or API unavailable");
    return [];
  }

  try {
    // Use pull to get the page's direct children
    const pageData = window.roamAlphaAPI.pull(
      '[:block/uid {:block/children [:block/uid :block/string :block/order]}]',
      [':block/uid', pageUid]
    );

    if (!pageData || !pageData[':block/children']) {
      if (DEBUG) console.log(`No root blocks found in page ${pageUid}`);
      return [];
    }

    // Sort by order
    const blocks = pageData[':block/children']
      .sort((a, b) => (a[':block/order'] || 0) - (b[':block/order'] || 0));

    if (DEBUG) console.log(`Found ${blocks.length} root blocks in page ${pageUid}`);
    return blocks;
  } catch (err) {
    console.error("Error in getRootBlocks:", err);
    return [];
  }
};

// Count how many root blocks would match a given tag filter (for preview)
const countMatchingRoots = (rootBlocks, tagName) => {
  if (!tagName || !rootBlocks || rootBlocks.length === 0) {
    return rootBlocks ? rootBlocks.length : 0;
  }

  try {
    let count = 0;
    for (const root of rootBlocks) {
      const rootUid = root[':block/uid'] || root.uid;
      if (!rootUid) continue;

      // Quick check: does any block under this root reference the tag?
      const result = window.roamAlphaAPI.data.q(`
        [:find ?block .
         :where
         [?tag :node/title "${escapeDatalogString(tagName)}"]
         [?block :block/refs ?tag]
         [?root :block/uid "${escapeDatalogString(rootUid)}"]
         (or
           [?block :block/parents ?root]
           (and
             [?block :block/parents ?ancestor]
             [?ancestor :block/parents ?root]))]
      `);
      if (result) count++;
    }
    return count;
  } catch (err) {
    console.error("Error in countMatchingRoots:", err);
    return rootBlocks.length;
  }
};

// Get filtered children of a root block (or all children if no filter)
const getFilteredChildren = (rootUid, tagName = null) => {
  if (!rootUid) return [];

  try {
    if (!tagName) {
      // No filter - return complete tree
      const fullTree = getBlockWithDescendants(rootUid);
      return fullTree?.children || [];
    }

    // With filter - find children that contain the tag
    const results = window.roamAlphaAPI.data.q(`
      [:find (pull ?block [:block/uid :block/string :block/order
                           {:block/parents [:block/uid :block/string :block/order]}])
       :where
       [?tag :node/title "${escapeDatalogString(tagName)}"]
       [?block :block/refs ?tag]
       [?block :block/parents ?parent]
       [?parent :block/uid "${escapeDatalogString(rootUid)}"]]
    `);

    if (!results || results.length === 0) {
      // Also check for deeper descendants
      const deepResults = window.roamAlphaAPI.data.q(`
        [:find (pull ?block [:block/uid :block/string :block/order
                             {:block/parents [:block/uid :block/string :block/order]}])
         :where
         [?tag :node/title "${escapeDatalogString(tagName)}"]
         [?block :block/refs ?tag]
         [?root :block/uid "${escapeDatalogString(rootUid)}"]
         [?block :block/parents ?ancestor]
         [?ancestor :block/parents ?root]]
      `);

      if (!deepResults || deepResults.length === 0) {
        return [];
      }

      // For deep matches, get the block with its full subtree
      return deepResults
        .map(r => r[0])
        .filter(Boolean)
        .map(block => {
          const uid = block[":block/uid"] || block.uid;
          const fullTree = getBlockWithDescendants(uid);
          return fullTree;
        })
        .filter(Boolean)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // For direct children matches, get each with its full subtree
    return results
      .map(r => r[0])
      .filter(Boolean)
      .map(block => {
        const uid = block[":block/uid"] || block.uid;
        const fullTree = getBlockWithDescendants(uid);
        return fullTree;
      })
      .filter(Boolean)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

  } catch (err) {
    console.error("Error in getFilteredChildren:", err);
    return [];
  }
};

// Convert root block to markdown with H1 heading
const rootBlockToMarkdown = (rootContent, childrenTree) => {
  let markdown = `# ${rootContent}\n\n`;

  if (childrenTree && childrenTree.length > 0) {
    markdown += treeToMarkdown(childrenTree);
  }

  return markdown;
};

// Generate safe filename from block content
// Auxiliary helper to parse Roam dates like "June 14th, 2026" or "June 14, 2026"
const parseRoamDate = (dateStr) => {
  if (!dateStr) return null;
  const match = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s(\d{1,2})(?:st|nd|rd|th)?,\s(\d{4})/);
  if (!match) return null;
  const monthNames = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
  };
  const month = monthNames[match[1]];
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  return new Date(year, month, day);
};

// Generate date string in YYYYMMDD format without dashes/internal underscores
const generateDateString = (dateObj = new Date()) => {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

// Extract date from block content first, then page title, otherwise use today's date
const extractDate = (blockContent, pageName) => {
  if (blockContent) {
    const blockDate = parseRoamDate(blockContent);
    if (blockDate) return generateDateString(blockDate);
  }
  if (pageName) {
    const pageDate = parseRoamDate(pageName);
    if (pageDate) return generateDateString(pageDate);
  }
  return generateDateString(new Date());
};

// Clean text to camelCase/PascalCase, preserving camelCase of acronyms/words if they already have internal uppercase
const sanitizeToCamelCase = (text, isCamel = false) => {
  if (!text) return '';
  // Remove diacritics
  let clean = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Remove double brackets [[]], keep inner text
  clean = clean.replace(/\[\[([^\]]+)\]\]/g, '$1');
  // Remove markdown formatting
  clean = clean.replace(/[*_`#]/g, '');
  
  // Replace Windows forbidden characters (< > : " | ? *) with spaces so they act as word boundaries
  clean = clean.replace(/[<>:"|?*]/g, ' ');
  
  // Split by spaces, dashes, slashes, backslashes
  const segments = clean.split(/[\s\-\\\/]+/).filter(Boolean);
  if (segments.length === 0) return '';
  
  return segments.map((seg, i) => {
    // If it's already camelCased (has uppercase letters not at the start), preserve it
    const hasInternalUppercase = /[a-z][A-Z]/.test(seg);
    // If it's all uppercase (acronyms like AI, EPUB, etc.), preserve it
    const isAllUppercase = /^[A-Z\d]+$/.test(seg);

    if (hasInternalUppercase || isAllUppercase) {
      if (isCamel && i === 0) {
        return seg.charAt(0).toLowerCase() + seg.slice(1);
      } else {
        return seg.charAt(0).toUpperCase() + seg.slice(1);
      }
    }
    
    // Otherwise, convert standard word to camelCase/PascalCase
    if (isCamel && i === 0) {
      return seg.toLowerCase();
    } else {
      return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
    }
  }).join('');
};

// Generate safe filename from block content without extension
const generateRootFilename = (blockContent) => {
  if (!blockContent) return "untitled";

  // Step 1: Check if there is bold text at the beginning of the block as the title
  let title = '';
  // Match bold block headers, possibly preceded by date link (like [[June 14th, 2026]] **title**)
  const dateRemovedContent = blockContent.replace(/^\[\[[^\]]+\]\]\s*/, '');
  const boldMatch = dateRemovedContent.match(/^\s*\*\*([^*]+)\*\*/);
  if (boldMatch) {
    title = boldMatch[1];
  } else {
    // Fallback: take first 5 words of clean block content (removing date link first if present)
    // Clean up URLs and local paths (Windows & Unix) to prevent them from inflating word count/filename length
    const cleanContent = dateRemovedContent
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[*_`#]/g, '')
      .replace(/https?:\/\/[^\s]*/g, '')    // Remove URLs
      .replace(/[A-Za-z]:\\[^\s]*/g, '')    // Remove Windows absolute paths
      .replace(/\/[\w\d_.-]+[^\s]*/g, '');  // Remove Unix paths/slashes with text
    const words = cleanContent.split(/\s+/).filter(Boolean);
    title = words.slice(0, 5).join(' ');
  }

  const safe = sanitizeToCamelCase(title, true);
  return safe || 'untitled';
};

// Generate PascalCase/camelCase filename from page title with namespace
// "entrevista/real/María Paz" → "Entrevista_Real_MariaPaz"
const generatePageFilename = (fullTitle) => {
  if (!fullTitle) return 'untitled';
  let result = fullTitle.split('/').map((segment) => {
    return sanitizeToCamelCase(segment, false); // PascalCase each segment
  }).filter(Boolean).join('_') || 'untitled';

  // Limit page namespace filename part to max 80 chars
  if (result.length > 80) {
    result = result.substring(0, 80);
  }
  return result;
};

// Sanitize final filename from any Windows forbidden characters (in case of manual inputs)
// Also ensures there are no duplicate extensions (like .md.md) and truncates length to avoid Windows path errors (max 120 chars)
const sanitizeFilename = (filename) => {
  if (!filename) return '';
  // Replace Windows forbidden characters: < > : " / \ | ? *
  let safe = filename.replace(/[<>:"/\\|?*]/g, '_');
  
  // Fix double extensions case-insensitively (e.g. .md.md, .Md.md, .md.MD -> .md)
  safe = safe.replace(/(\.[a-zA-Z0-9]+)(\.[a-zA-Z0-9]+)$/i, (match, p1, p2) => {
    if (p1.toLowerCase() === p2.toLowerCase()) {
      return p1;
    }
    return match;
  });

  // Truncate to maximum 120 characters to avoid Windows "path too long" error (0x80010135)
  // We want to keep the extension intact, so we only truncate the base name part.
  const lastDot = safe.lastIndexOf('.');
  if (lastDot > 0) {
    const name = safe.substring(0, lastDot);
    const ext = safe.substring(lastDot);
    const maxNameLen = 120 - ext.length;
    if (name.length > maxNameLen) {
      safe = name.substring(0, maxNameLen) + ext;
    }
  } else if (safe.length > 120) {
    safe = safe.substring(0, 120);
  }
  
  return safe;
};

// --- tree-builder.js ---
const DEBUG = true; // Set to false in production

// Favorite tags for quick filter selection in Export by Root Blocks modal
// Edit this list to customize your frequently used tags
const FAVORITE_TAGS = [
  'textoÍntegro',
  'Gemini/Pro/3.0/resumen',
  'Gemini/Pro/3.0/respuestas',
  'Claude/Sonnet/4.5/resumen',
  'Claude/Sonnet/4.5/respuestas',
  'Claude/Opus/4.5/respuestas',
];


/**
 * Builds a unified hierarchical tree structure from a flat list of block nodes.
 * Used to construct the export tree preserving parent-child relationships and ordering.
 *
 * @param {Array<Object>} targetBlocks - Array of raw block objects containing their parents trace
 * @returns {Array<Object>} Array of root node objects with populated `children` arrays
 */
const buildExportTree = (targetBlocks) => {
  if (!targetBlocks || targetBlocks.length === 0) {
    return [];
  }

  if (DEBUG) {
    console.log("=== buildExportTree DEBUG ===");
    console.log("Target blocks received:", JSON.stringify(targetBlocks, null, 2));
  }

  const nodeMap = new Map();
  const rootUids = new Set();

  for (const block of targetBlocks) {
    // Handle both prefixed (:block/uid) and non-prefixed (uid) attribute names
    const uid = block.uid || block[":block/uid"];
    const content = block.string || block[":block/string"] || "";
    const heading = block.heading || block[":block/heading"] || 0;
    const parents = block.parents || block[":block/parents"] || [];

    if (DEBUG) {
      console.log(`Processing block: uid=${uid}, content="${content}", parents count=${parents.length}`);
    }

    // Add the target block itself
    // Get the block's order from the query result
    const blockOrder = block.order || block[":block/order"] || 0;

    if (!nodeMap.has(uid)) {
      nodeMap.set(uid, {
        uid,
        content,
        heading,
        children: [],
        order: blockOrder,
        isTarget: true
      });
    } else {
      // Update content if already exists (might have been added as parent reference)
      const existingNode = nodeMap.get(uid);
      existingNode.isTarget = true;
      existingNode.order = blockOrder; // Update order
      if (!existingNode.content && content) {
        existingNode.content = content;
      }
    }

    if (parents.length === 0) {
      rootUids.add(uid);
    } else {
      // Parents come from root to leaf, we need to process leaf to root
      // So we reverse to go from immediate parent to root
      const sortedParents = [...parents].reverse();

      let childUid = uid;
      for (let i = 0; i < sortedParents.length; i++) {
        const parent = sortedParents[i];
        // Handle both prefixed and non-prefixed attribute names
        const parentUid = parent.uid || parent[":block/uid"];
        const parentContent = parent.string || parent[":block/string"] || parent.title || parent[":node/title"] || "";
        const parentOrder = parent.order || parent[":block/order"] || 0;
        const parentHeading = parent.heading || parent[":block/heading"] || 0;

        // Skip parents with empty content - connect child directly to grandparent
        if (!parentContent || parentContent.trim() === "") {
          if (DEBUG) {
            console.log(`  Skipping empty parent: uid=${parentUid}`);
          }
          // If this is the last parent (root) and it's empty, mark child as root
          if (i === sortedParents.length - 1) {
            rootUids.add(childUid);
          }
          continue;
        }

        if (DEBUG && i === 0) {
          console.log(`  First parent: uid=${parentUid}, content="${parentContent}", order=${parentOrder}`);
        }

        if (!nodeMap.has(parentUid)) {
          nodeMap.set(parentUid, {
            uid: parentUid,
            content: parentContent,
            heading: parentHeading,
            children: [],
            order: parentOrder,
            isTarget: false
          });
        }

        const parentNode = nodeMap.get(parentUid);
        const childNode = nodeMap.get(childUid);

        // Get child's order from the parent's perspective
        if (i === 0) {
          // First iteration - childUid is the target block
          // Get its order from the query data (target block's order relative to its immediate parent)
          const targetBlock = targetBlocks.find(b => (b.uid || b[":block/uid"]) === uid);
          const targetOrder = targetBlock?.parents?.find(p => (p.uid || p[":block/uid"]) === parentUid);
          if (targetOrder) {
            childNode.order = targetOrder.order || targetOrder[":block/order"] || 0;
          }
        }

        if (childNode && !parentNode.children.some(c => c.uid === childUid)) {
          parentNode.children.push(childNode);
        }

        childUid = parentUid;

        // Last parent in our reversed list is the root
        if (i === sortedParents.length - 1) {
          rootUids.add(parentUid);
        }
      }
    }
  }

  // Fetch complete descendants for target nodes
  for (const [uid, node] of nodeMap) {
    if (node.isTarget) {
      if (DEBUG) {
        console.log(`Fetching descendants for target: uid=${uid}, content="${node.content}"`);
      }
      const fullTree = getBlockWithDescendants(uid);
      if (DEBUG) {
        console.log(`  Full tree result:`, fullTree);
      }
      if (fullTree && fullTree.children && fullTree.children.length > 0) {
        node.children = fullTree.children;
      }
    }
  }

  // Sort all children by order before returning
  const sortChildren = (node) => {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => (a.order || 0) - (b.order || 0));
      node.children.forEach(sortChildren);
    }
  };

  // Calculate global order path for each root by tracing back through ancestors
  // This creates a comparable path like "0.3.2" representing the position at each level
  const calculateGlobalOrderPath = (rootUid) => {
    // Find the target block that led to this root
    for (const block of targetBlocks) {
      const uid = block.uid || block[":block/uid"];
      const parents = block.parents || block[":block/parents"] || [];

      // Check if this block's ancestry includes the root
      if (parents.length === 0 && uid === rootUid) {
        // This target block is itself a root
        const blockOrder = block.order || block[":block/order"] || 0;
        return [blockOrder];
      }

      // Check if rootUid is in the parents chain
      let foundInParents = false;
      let rootIndex = -1;
      for (let i = 0; i < parents.length; i++) {
        const parentUid = parents[i].uid || parents[i][":block/uid"];
        if (parentUid === rootUid) {
          foundInParents = true;
          rootIndex = i;
          break;
        }
      }

      if (foundInParents) {
        // Build order path from root (or page) down to this block
        const orderPath = [];

        // Add orders from the root's position down to the target block
        for (let i = rootIndex; i >= 0; i--) {
          const parent = parents[i];
          const parentOrder = parent.order || parent[":block/order"] || 0;
          orderPath.push(parentOrder);
        }

        // Add the target block's own order
        const blockOrder = block.order || block[":block/order"] || 0;
        orderPath.push(blockOrder);

        return orderPath;
      }
    }

    // Fallback: return just the node's own order
    const node = nodeMap.get(rootUid);
    return [node?.order || 0];
  };

  // Compare two order paths lexicographically
  const compareOrderPaths = (pathA, pathB) => {
    const maxLen = Math.max(pathA.length, pathB.length);
    for (let i = 0; i < maxLen; i++) {
      const a = pathA[i] ?? 0;
      const b = pathB[i] ?? 0;
      if (a !== b) {
        return a - b;
      }
    }
    return 0;
  };

  const roots = [];
  for (const uid of rootUids) {
    const node = nodeMap.get(uid);
    if (node) {
      sortChildren(node);
      node.globalOrderPath = calculateGlobalOrderPath(uid);
      roots.push(node);
    }
  }

  // Sort roots by their global order path
  roots.sort((a, b) => compareOrderPaths(a.globalOrderPath || [0], b.globalOrderPath || [0]));

  if (DEBUG) {
    console.log("Final roots (sorted by global order):", JSON.stringify(roots.map(r => ({
      uid: r.uid,
      content: r.content?.substring(0, 50),
      globalOrderPath: r.globalOrderPath
    })), null, 2));
  }

  return roots;
};

// --- exporter.js ---
/**
 * Converts a tree of block nodes to Markdown.
 * Supports both hierarchical (with bullets/indentation) and flat (paragraphs) formats.
 *
 * @param {Array<Object>} trees - Array of root block trees
 * @param {number} indentLevel - Current indentation level (used for recursion)
 * @param {Object} options - Formatting options
 * @param {string} options.structure - 'hierarchical' (default) or 'flat'
 * @returns {string} The resulting markdown text
 */
const treeToMarkdown = (trees, indentLevel = 0, options = {}) => {
  if (!trees || trees.length === 0) {
    return "";
  }

  const { structure = 'hierarchical' } = options;
  const isFlat = structure === 'flat';
  const lines = [];
  const indent = isFlat ? "" : "  ".repeat(indentLevel);

  for (const node of trees) {
    let nodeText = node.content;

    // Apply heading if present and not already manually added
    if (node.heading && node.heading > 0) {
      if (nodeText && !nodeText.trim().match(/^#{1,6}\s/)) {
        nodeText = "#".repeat(node.heading) + " " + nodeText;
      }
    }

    if (isFlat) {
      if (nodeText && nodeText.trim()) {
        lines.push(`${nodeText}\n`);
      }
    } else {
      lines.push(`${indent}- ${nodeText}`);
    }

    if (node.children && node.children.length > 0) {
      const childrenMd = treeToMarkdown(node.children, isFlat ? 0 : indentLevel + 1, options);
      if (childrenMd) {
        lines.push(childrenMd);
      }
    }
  }

  if (isFlat && indentLevel === 0) {
    // Para flat markdown devolvemos bloques separados por doble salto de línea
    return lines.join("\n").replace(/\n{3,}/g, '\n\n').trim() + '\n\n';
  }
  return lines.join("\n");
};

const generateFilename = (tagName) => {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0];
  const safeTagName = tagName.replace(/[^a-zA-Z0-9]/g, "_");
  return `export_${safeTagName}_${dateStr}.md`;
};

const downloadFile = (content, filename) => {
  try {
    const safeFilename = sanitizeFilename(filename);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = safeFilename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    return true;
  } catch (err) {
    console.error("Error downloading file:", err);
    return false;
  }
};

// Download a blob directly (for EPUB files)
const downloadBlob = (blob, filename) => {
  try {
    const safeFilename = sanitizeFilename(filename);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFilename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    return true;
  } catch (err) {
    console.error('Error downloading blob:', err);
    return false;
  }
};

const generateHeader = (tagName, blockCount) => {
  const date = new Date().toLocaleString();
  return `# Export: #${tagName}
> Generated: ${date}
> Blocks found: ${blockCount}

---

`;
};

// ============================================
// EPUB 3.0 EXPORT FUNCTIONS (manual generator)
// Uses JSZip directly — no jEpub dependency
// ============================================

// Helper to escape XML/XHTML special characters
const escapeHTML = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Iteratively get parent blocks up to the page root to ensure correct ordering
const getOrderedBlockAncestors = (blockUid) => {
  if (!isRoamAPIAvailable() || !blockUid) return [];
  const ancestors = [];
  let currentUid = blockUid;

  try {
    while (true) {
      const result = window.roamAlphaAPI.data.q(`
        [:find ?parentUid ?parentString
         :where
         [?child :block/uid "${escapeDatalogString(currentUid)}"]
         [?parent :block/children ?child]
         [?parent :block/uid ?parentUid]
         [?parent :block/string ?parentString]]
      `);

      if (result && result.length > 0 && result[0][0]) {
        ancestors.unshift({
          uid: result[0][0],
          content: result[0][1] || ""
        });
        currentUid = result[0][0];
      } else {
        break;
      }
    }
  } catch (err) {
    console.error('Error getting ordered ancestors:', err);
  }
  return ancestors;
};

// Get block ancestors from page to the block itself
const getBlockAncestors = (blockUid) => {
  if (!isRoamAPIAvailable() || !blockUid) return [];
  try {
    const result = window.roamAlphaAPI.data.q(`
      [:find (pull ?block [{:block/parents [:block/uid :block/string :block/order]}])
       :where
       [?block :block/uid "${escapeDatalogString(blockUid)}"]]
    `);
    if (!result || !result[0] || !result[0][0]) return [];

    const parents = result[0][0][':block/parents'] || [];
    return parents
      .filter(p => p[':block/string'])
      .map(p => p[':block/string']);
  } catch (err) {
    console.error('Error getting ancestors:', err);
    return [];
  }
};

const generateBreadcrumb = (pageName, blockUid) => {
  const ancestors = getBlockAncestors(blockUid);
  const parts = [pageName, ...ancestors];
  if (parts.length <= 1) return null;

  return {
    md: `\n> **Ruta:** ${parts.join(' → ')}`,
    xhtml: `<div class="breadcrumb" style="font-size: 0.85em; color: #666; margin-bottom: 0.8em; padding: 0.5em; background: #f9f9f9; border-radius: 4px;"><strong>Ruta:</strong> ${parts.map(p => escapeHTML(p)).join(' &rarr; ')}</div>\n`
  };
};

// Transform Roam Markdown to XHTML for EPUB
const roamMarkupToHtml = (str) => {
  if (!str) return '';
  // First, escape HTML characters to prevent malformed tags
  let html = escapeHTML(str);

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/__(.*?)__/g, '<em>$1</em>');
  // Highlight
  html = html.replace(/\^\^(.*?)\^\^/g, '<mark>$1</mark>');
  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // External links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Roam specific links
  // Page refs: [[Page]]
  html = html.replace(/\[\[(.*?)\]\]/g, '<span class="roam-page">$1</span>');
  // Hash Tags: #[[Tag]]
  html = html.replace(/#\[\[(.*?)\]\]/g, '<span class="roam-tag">#$1</span>');
  // Simple Hash Tags: #Tag
  html = html.replace(/#([a-zA-Z0-9_\-]+)/g, '<span class="roam-tag">#$1</span>');

  return html;
};

// Generate a UUID v4
const generateEpubUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Convert tree to XHTML content for EPUB chapter
const treeToXhtml = (trees, options = {}, level = 0) => {
  if (!trees || trees.length === 0) return '';

  const {
    levelIndicator = 'indent',   // indent | line | number
    structure = 'hierarchical'   // hierarchical | flat
  } = options;

  const isFlat = structure === 'flat';
  let xhtml = '';

  if (!isFlat) {
    // Choose CSS class based on indicator type
    const ulClass = levelIndicator === 'line'
      ? (level > 0 ? 'level-line' : 'level-root')
      : (levelIndicator === 'number' ? 'level-numbered' : 'level-indent');

    xhtml += `<ul class="${ulClass} depth-${level}">`;
  }

  for (const node of trees) {
    const isHeading = node.heading && node.heading > 0;

    let breadcrumbHtml = '';
    if (level === 0 && node.breadcrumbXhtml) {
      breadcrumbHtml = node.breadcrumbXhtml;
    }

    if (isFlat) {
      if (isHeading) {
        xhtml += `${breadcrumbHtml}<h${node.heading}>${roamMarkupToHtml(node.content)}</h${node.heading}>\n`;
      } else {
        xhtml += `${breadcrumbHtml}<p>${roamMarkupToHtml(node.content)}</p>\n`;
      }
    } else {
      if (isHeading) {
        xhtml += `<li>${breadcrumbHtml}<h${node.heading}>${roamMarkupToHtml(node.content)}</h${node.heading}>`;
      } else {
        xhtml += `<li>${breadcrumbHtml}${roamMarkupToHtml(node.content)}`;
      }
    }

    if (node.children && node.children.length > 0) {
      xhtml += treeToXhtml(node.children, options, isFlat ? 0 : level + 1);
    }

    if (!isFlat) {
      xhtml += '</li>';
    }
  }

  if (!isFlat) {
    xhtml += '</ul>';
  }
  return xhtml;
};

// --- EPUB 3.0 structure files ---

const epubCreateContainerXml = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
};

const epubCreateContentOpf = (title, uuid, date) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeHTML(title)}</dc:title>
    <dc:creator>Roam Export Filter</dc:creator>
    <dc:language>es</dc:language>
    <dc:date>${date}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="nav"/>
    <itemref idref="chapter1"/>
  </spine>
</package>`;
};

const epubCreateTocNcx = (title, uuid) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeHTML(title)}</text></docTitle>
  <navMap>
    <navPoint id="navpoint1" playOrder="1">
      <navLabel><text>Tabla de Contenidos</text></navLabel>
      <content src="nav.xhtml"/>
    </navPoint>
    <navPoint id="navpoint2" playOrder="2">
      <navLabel><text>${escapeHTML(title)}</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`;
};

const epubCreateNavXhtml = (title) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeHTML(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Tabla de Contenidos</h1>
    <ol>
      <li><a href="chapter1.xhtml">${escapeHTML(title)}</a></li>
    </ol>
  </nav>
</body>
</html>`;
};

const epubCreateStylesCss = (options = {}) => {
  const {
    blockSpacing = 'normal',    // compact | normal | wide
    levelSpacing = 'subtle',    // none | subtle | marked
    levelIndicator = 'indent'   // indent | line | number
  } = options;

  const blockMargins = { compact: '0.2em', normal: '0.5em', wide: '1em' };
  const levelMargins = { none: '0', subtle: '0.3em', marked: '0.8em' };

  return `body {
  font-family: Georgia, "Times New Roman", serif;
  margin: 1em;
  line-height: 1.6;
}
h1 {
  font-family: Helvetica, Arial, sans-serif;
  font-size: 1.6em;
  margin-bottom: 0.5em;
}
nav ol {
  list-style-type: decimal;
  padding-left: 1.5em;
}
nav li {
  margin: 0.3em 0;
}
/* Block spacing (list items) */
li {
  margin-bottom: ${blockMargins[blockSpacing]};
}
/* Flat structure paragraphs */
p {
  margin-top: 0;
  margin-bottom: ${blockMargins[blockSpacing]};
}
/* Flat structure headings */
h1, h2, h3, h4, h5, h6 {
  margin-top: 1.2em;
  margin-bottom: 0.5em;
  line-height: 1.3;
}
/* Skip top margin for first heading */
body > h1:first-child, body > h2:first-child, body > h3:first-child {
  margin-top: 0;
}
/* Root-level lists */
ul.depth-0 {
  margin-left: 0;
  padding-left: 1.5em;
}
/* Nested lists - level spacing */
ul {
  margin-top: ${levelMargins[levelSpacing]};
  margin-left: 1.5em;
  padding-left: 1.5em;
}
/* Indicator: indent (default bullets) */
ul.level-indent {
  list-style-type: disc;
}
/* Indicator: line (vertical border) */
ul.level-line {
  border-left: 2px solid #ccc;
  padding-left: 1em;
  margin-left: 0.5em;
  list-style-type: none;
}
ul.level-root {
  list-style-type: none;
}
/* Indicator: numbered */
ul.level-numbered {
  list-style-type: decimal;
}
/* Roam Markdown Styles */
mark {
  background-color: #fef08a;
  color: #1f2937;
  padding: 0 0.2em;
  border-radius: 0.2em;
}
code {
  font-family: Consolas, Monaco, 'Courier New', monospace;
  background-color: #f3f4f6;
  padding: 0.1em 0.3em;
  border-radius: 0.2em;
  font-size: 0.9em;
}
.roam-page {
  color: #2563eb;
  text-decoration: none;
}
.roam-tag {
  color: #6b7280;
  font-style: italic;
  font-size: 0.95em;
}`;
};

const epubCreateChapterXhtml = (title, bodyXhtml) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeHTML(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>${escapeHTML(title)}</h1>
${bodyXhtml}
</body>
</html>`;
};

// Generate EPUB blob without downloading (for ZIP packaging)
const generateEpubBlob = async (tree, title, options = {}) => {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  const uuid = generateEpubUUID();
  const date = new Date().toISOString().split('T')[0];
  const bodyXhtml = treeToXhtml(tree, options);

  // 1. mimetype — MUST be first file and uncompressed (EPUB spec)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file('META-INF/container.xml', epubCreateContainerXml());

  // 3. OEBPS/content.opf (EPUB 3.0 package)
  zip.file('OEBPS/content.opf', epubCreateContentOpf(title, uuid, date));

  // 4. OEBPS/toc.ncx (EPUB 2.0 navigation — backward compat)
  zip.file('OEBPS/toc.ncx', epubCreateTocNcx(title, uuid));

  // 5. OEBPS/nav.xhtml (EPUB 3.0 navigation)
  zip.file('OEBPS/nav.xhtml', epubCreateNavXhtml(title));

  // 6. OEBPS/styles.css
  zip.file('OEBPS/styles.css', epubCreateStylesCss(options));

  // 7. OEBPS/chapter1.xhtml
  zip.file('OEBPS/chapter1.xhtml', epubCreateChapterXhtml(title, bodyXhtml));

  // Generate the EPUB as a blob
  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
};

// Generate and download EPUB file
const downloadAsEpub = async (tree, title, options = {}) => {
  try {
    const blob = await generateEpubBlob(tree, title, options);
    const safeTitle = title.split(' - ').map(part => sanitizeToCamelCase(part, false)).join('_');
    const filename = `${safeTitle || 'export'}.epub`;
    return downloadBlob(blob, filename);
  } catch (err) {
    console.error('Error generating EPUB:', err);
    return false;
  }
};

// ============================================
// MAIN EXTENSION LOGIC
// ============================================

// Clean user input to extract just the page/tag name
// Supports: #tag, [[tag]], #[[tag]], or just "tag"
const cleanTagInput = (input) => {
  if (!input) return null;

  let cleaned = input.trim();

  // Remove # prefix
  if (cleaned.startsWith('#')) {
    cleaned = cleaned.substring(1);
  }

  // Remove [[ prefix and ]] suffix
  if (cleaned.startsWith('[[') && cleaned.endsWith(']]')) {
    cleaned = cleaned.substring(2, cleaned.length - 2);
  }

  return cleaned.trim() || null;
};

const showNotification = (message, backgroundColor) => {
  try {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${backgroundColor};
      color: white;
      padding: 10px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
      font-size: 14px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2500);
  } catch (err) {
    console.error("Error showing notification:", err);
  }
};

// ============================================
// UNIFIED EXPORT MODAL (with tabs)
// ============================================

// Unified export modal with tabs for "Por Filtros" and "Por Ramas"
const promptUnifiedExport = (pageName, pageUid) => {
  return new Promise((resolve) => {
    let currentDepth = 2; // Default depth

    // Favorite Tags persistent storage helper
    const getFavoriteTags = () => {
      const stored = localStorage.getItem('roam-export-favorite-tags');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // fallback
        }
      }
      return ['textoÍntegro', 'Gemini/Pro/3.0/resumen', 'Gemini/Pro/3.0/respuestas', 'Claude/Sonnet/4.5/resumen', 'Claude/Sonnet/4.5/respuestas', 'Claude/Opus/4.5/respuestas'];
    };

    const saveFavoriteTags = (tags) => {
      localStorage.setItem('roam-export-favorite-tags', JSON.stringify(tags));
    };

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create modal - LARGER for 1920x1080 screens
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 0;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 1200px;
      width: 90vw;
      max-width: 1400px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
      overflow: hidden;
    `;

    // Tab styles
    const tabStyle = (active) => `
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      background: ${active ? 'white' : '#f0f0f0'};
      color: ${active ? '#137CBD' : '#666'};
      cursor: pointer;
      border-bottom: ${active ? '2px solid #137CBD' : '2px solid transparent'};
      transition: all 0.2s;
    `;

    // Depth button style
    const depthBtnStyle = (isActive) => `
      padding: 6px 12px;
      font-size: 13px;
      border: 1px solid ${isActive ? '#137CBD' : '#ccc'};
      background: ${isActive ? '#137CBD' : 'white'};
      color: ${isActive ? 'white' : '#666'};
      cursor: pointer;
      transition: all 0.2s;
    `;

    // Render tree structure with checkboxes for "Por Ramas" tab
    const renderTree = (nodes, indentLevel = 0) => {
      if (!nodes || nodes.length === 0) return indentLevel === 0 ? '<p style="color: #888; padding: 12px;">No hay bloques en esta página</p>' : '';
      return nodes.map(node => {
        const hasChildren = (node.children && node.children.length > 0);
        const childCount = node.hasDeepChildren ? node.deepChildrenCount : (node.children?.length || 0);
        const deepInfo = childCount > 0 ? ` <span class="tree-deep-info" style="color: #888; font-size: 11px;">(+${childCount} sub-bloques)</span>` : '';

        const toggleBtn = hasChildren
          ? `<span class="tree-toggle" data-uid="${node.uid}" style="cursor: pointer; width: 16px; display: inline-flex; justify-content: center; align-items: center; color: #888; font-size: 11px; user-select: none; flex-shrink: 0; padding-top: 4px; transition: transform 0.2s;" title="Expandir/Colapsar">▶</span>`
          : `<span style="width: 16px; display: inline-block; flex-shrink: 0;"></span>`;

        const childrenHtml = hasChildren
          ? `<div class="tree-children" data-parent-uid="${node.uid}" style="display: none; padding-left: 20px;">
               ${renderTree(node.children, indentLevel + 1)}
             </div>`
          : '';

        return `
          <div class="tree-node" style="padding: 2px 0;" data-level="${indentLevel}">
            <div style="display: flex; align-items: flex-start; gap: 4px;">
              ${toggleBtn}
              <label style="display: flex; align-items: flex-start; cursor: pointer; gap: 6px; flex: 1;">
                <input type="checkbox" data-uid="${node.uid}" class="branch-checkbox" style="margin-top: 3px; cursor: pointer; min-width: 14px;">
                <span class="node-text-span" style="font-size: 14px; line-height: 1.5;" title="${(node.fullContent || node.content || '').replace(/"/g, '&quot;')}">${node.content}${deepInfo}</span>
              </label>
            </div>
            ${childrenHtml}
          </div>
        `;
      }).join('');
    };

    // Get initial structure with default depth
    let structure = getPageStructure(pageUid, currentDepth);

    // Detect child pages for namespace tab (pre-loaded suggestions)
    const childPages = getChildPages(pageName);

    // Render pages list for "Por Páginas" tab
    const renderPagesList = (pages) => {
      if (!pages || pages.length === 0) return '<p style="color: #888; padding: 12px;">Busca páginas para agregar a la lista</p>';
      return pages.map(page => `
        <div style="padding: 5px 0;">
          <label style="display: flex; align-items: center; cursor: pointer; gap: 8px;">
            <input type="checkbox" data-uid="${page.uid}" data-title="${page.title.replace(/"/g, '&quot;')}" data-short="${page.shortName.replace(/"/g, '&quot;')}" class="page-checkbox" style="cursor: pointer; min-width: 16px;">
            <span style="font-size: 14px; line-height: 1.5;">📄 ${page.shortName}</span>
          </label>
        </div>
      `).join('');
    };

    modal.innerHTML = `
      <!-- Header with tabs and group labels -->
      <div style="background: #f5f5f5; border-bottom: 1px solid #e0e0e0; flex-shrink: 0;">
        <div style="display: flex; align-items: flex-end;">
          <!-- "Esta página" group -->
          <div style="flex: 0 0 auto;">
            <div style="font-size: 11px; color: #999; padding: 6px 12px 2px 12px; text-align: center;">📍 Esta página</div>
            <div style="display: flex;">
              <button id="tab-branches" style="${tabStyle(true)}">🌳 Por Ramas</button>
            </div>
          </div>
          <!-- Separator -->
          <div style="border-left: 2px solid #ddd; align-self: stretch; margin: 6px 0;"></div>
          <!-- "Múltiples páginas" group -->
          <div style="flex: 0 0 auto;">
            <div style="font-size: 11px; color: #999; padding: 6px 12px 2px 12px; text-align: center;">📑 Múltiples páginas</div>
            <div style="display: flex;">
              <button id="tab-pages" style="${tabStyle(false)}">📄 Por Páginas</button>
            </div>
          </div>
          <!-- Separator -->
          <div style="border-left: 2px solid #ddd; align-self: stretch; margin: 6px 0;"></div>
          <!-- "Guardados" group -->
          <div style="flex: 0 0 auto;">
            <div style="font-size: 11px; color: #999; padding: 6px 12px 2px 12px; text-align: center;">🗂️ Guardados</div>
            <div style="display: flex;">
              <button id="tab-presets" style="${tabStyle(false)}">📌 Presets</button>
            </div>
          </div>
          <div style="flex: 1;"></div>
          <span id="page-name-display" style="padding: 12px 16px; font-size: 12px; color: #888; align-self: center;">${pageName}</span>
        </div>
      </div>
      
      <!-- Tab content container -->
      <div style="padding: 20px; flex: 1; min-height: 0; box-sizing: border-box; display: flex; gap: 24px; overflow: hidden;">
        
        <!-- Left column: holds active tab content -->
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0;">
          
          <!-- Por Ramas content -->
          <div id="content-branches" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
            <!-- Interactive Search & Filtering + Depth Selector -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef; flex-wrap: wrap;">
              <!-- Search field -->
              <div style="display: flex; gap: 8px; align-items: center; flex: 1; min-width: 300px;">
                <span style="font-size: 13px; font-weight: 600; color: #495057; white-space: nowrap;">🔍 Filtrar Árbol:</span>
                <input type="text" id="branch-tree-search" 
                  style="flex: 1; padding: 8px 12px; font-size: 13px; border: 1px solid #ced4da; border-radius: 4px; box-sizing: border-box; outline: none; transition: border-color 0.2s;"
                  placeholder="Escribe un tag o palabra clave para filtrar el árbol visualmente (ej: #textoÍntegro)..."
                />
                <button id="clear-branch-search" style="
                  padding: 8px 14px;
                  font-size: 13px;
                  border: 1px solid #ced4da;
                  border-radius: 4px;
                  background: white;
                  color: #495057;
                  cursor: pointer;
                  display: none;
                  transition: all 0.2s;
                " onmouseover="this.style.background='#f1f3f5'" onmouseout="this.style.background='white'">
                  Limpiar
                </button>
                <button id="select-matching-btn" style="
                  padding: 8px 14px;
                  font-size: 13px;
                  border: 1px solid #137CBD;
                  border-radius: 4px;
                  background: #137CBD;
                  color: white;
                  cursor: pointer;
                  display: none;
                  transition: all 0.2s;
                " onmouseover="this.style.background='#106ba3'" onmouseout="this.style.background='#137CBD'">
                  Seleccionar Coincidencias
                </button>
              </div>
              
              <!-- Depth selector -->
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <span style="font-size: 13px; color: #666; white-space: nowrap;">Profundidad:</span>
                <div id="depth-selector" style="display: flex; border-radius: 4px; overflow: hidden;">
                  <button data-depth="1" style="${depthBtnStyle(false)}border-radius: 4px 0 0 4px;">1</button>
                  <button data-depth="2" style="${depthBtnStyle(true)}border-left: none;">2</button>
                  <button data-depth="3" style="${depthBtnStyle(false)}border-left: none;">3</button>
                  <button data-depth="4" style="${depthBtnStyle(false)}border-left: none; border-radius: 0 4px 4px 0;">4</button>
                </div>
                <span style="font-size: 12px; color: #999; white-space: nowrap;">niveles de jerarquía</span>
              </div>
            </div>

            <!-- Controls Bar: Branch Selection -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
              <span style="font-size: 13px; color: #666;">
                Selecciona las ramas que deseas exportar:
              </span>
              <div style="display: flex; gap: 8px; align-items: center;">
                <button id="expand-all-branches" style="
                  padding: 4px 12px;
                  font-size: 12px;
                  border: 1px solid #ccc;
                  border-radius: 4px;
                  background: white;
                  color: #666;
                  cursor: pointer;
                  transition: all 0.2s;
                ">⊞ Expandir todo</button>
                <button id="collapse-all-branches" style="
                  padding: 4px 12px;
                  font-size: 12px;
                  border: 1px solid #ccc;
                  border-radius: 4px;
                  background: white;
                  color: #666;
                  cursor: pointer;
                  transition: all 0.2s;
                ">⊟ Colapsar todo</button>
                <button id="select-all-branches" style="
                  padding: 4px 12px;
                  font-size: 12px;
                  border: 1px solid #137CBD;
                  border-radius: 4px;
                  background: white;
                  color: #137CBD;
                  cursor: pointer;
                  transition: all 0.2s;
                ">☑ Seleccionar todo</button>
                <button id="save-as-preset" style="
                  padding: 4px 12px;
                  font-size: 12px;
                  border: 1px solid #28a745;
                  border-radius: 4px;
                  background: white;
                  color: #28a745;
                  cursor: pointer;
                  transition: all 0.2s;
                " onmouseover="this.style.background='#eafaf1'" onmouseout="this.style.background='white'"
                  title="Guardar selección actual como preset">
                  💾 Guardar Preset
                </button>
              </div>
            </div>
            <div id="branch-filter-error" style="display: none; padding: 8px 12px; margin-bottom: 8px; background: #fff3f3; border: 1px solid #DC143C; border-radius: 4px; color: #DC143C; font-size: 13px;"></div>
            <div id="branch-tree-container" style="
              border: 1px solid #e0e0e0;
              border-radius: 4px;
              padding: 12px;
              flex: 1;
              min-height: 0;
              overflow-y: auto;
              background: #fafafa;
            ">
              ${renderTree(structure)}
            </div>
          </div>
          
          <!-- Por Páginas content -->
          <div id="content-pages" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
            <!-- Search bar -->
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <input type="text" id="page-search-input" 
                style="flex: 1; padding: 10px 14px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"
                placeholder="🔍 Buscar páginas por nombre..."
              />
              <button id="page-search-btn" style="
                padding: 10px 16px;
                font-size: 13px;
                border: 1px solid #137CBD;
                border-radius: 4px;
                background: #137CBD;
                color: white;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
              ">Buscar</button>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                Selecciona las páginas que deseas exportar:
              </p>
              <button id="select-all-pages" style="
                padding: 4px 12px;
                font-size: 12px;
                border: 1px solid #137CBD;
                border-radius: 4px;
                background: white;
                color: #137CBD;
                cursor: pointer;
                transition: all 0.2s;
              ">☑ Seleccionar todo</button>
            </div>
            <div id="page-filter-error" style="display: none; padding: 8px 12px; margin-bottom: 8px; background: #fff3f3; border: 1px solid #DC143C; border-radius: 4px; color: #DC143C; font-size: 13px;"></div>
            <div id="pages-list-container" style="
              border: 1px solid #e0e0e0;
              border-radius: 4px;
              padding: 12px;
              flex: 1;
              min-height: 0;
              overflow-y: auto;
              background: #fafafa;
            ">
              ${renderPagesList(childPages)}
            </div>
            <div style="margin-top: 12px; padding: 12px; background: #f5f5f5; border-radius: 4px; flex-shrink: 0;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                <input type="checkbox" id="page-filter-enabled">
                <span>Filtrar por tag (opcional):</span>
              </label>
              <input type="text" id="page-filter-tag" 
                style="width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-top: 8px; opacity: 0.5;"
                placeholder="Ej: #resumen"
                disabled
              />
            </div>
          </div>

          <!-- Presets content -->
          <div id="content-presets" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                Selecciones de bloques preguardadas (presets) para reutilizar en cualquier momento:
              </p>
            </div>
            <div id="presets-list-container" style="
              border: 1px solid #e0e0e0;
              border-radius: 4px;
              padding: 12px;
              flex: 1;
              min-height: 0;
              overflow-y: auto;
              background: #fafafa;
              display: flex;
              flex-direction: column;
              gap: 12px;
            ">
              <!-- Rendered dynamically -->
            </div>
          </div>

        </div>

        <!-- Right column: Export options & Format settings (Global & Persistent) -->
        <div style="width: 360px; flex-shrink: 0; overflow-y: auto; min-height: 0; box-sizing: border-box; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 1px solid #eee; display: flex; flex-direction: column; gap: 14px;">
          <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 4px; flex-shrink: 0;">⚙ Opciones de exportación</div>
          <div style="flex-shrink: 0;">
            <span style="font-size: 13px; color: #666; display: block; margin-bottom: 6px;">Nomenclatura de archivos:</span>
            <div id="branch-naming-selector" style="display: flex; border-radius: 4px; overflow: hidden; width: fit-content;">
              <button data-naming="block" class="active" style="padding: 4px 10px; font-size: 12px; border: 1px solid #137CBD; background: #137CBD; color: white; cursor: pointer; border-radius: 4px 0 0 4px;">Bloque</button>
              <button data-naming="page_block" style="padding: 4px 10px; font-size: 12px; border: 1px solid #ccc; border-left: none; background: white; color: #666; cursor: pointer;">Pág.+Bloque</button>
              <button data-naming="page" style="padding: 4px 10px; font-size: 12px; border: 1px solid #ccc; border-left: none; background: white; color: #666; cursor: pointer; border-radius: 0 4px 4px 0;">Página</button>
            </div>
            <div id="branch-naming-preview" style="font-size: 11px; color: #888; margin-top: 6px; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Ej: nombre_del_bloque.md</div>
          </div>
          
          <div style="height: 1px; background: #e0e0e0; margin: 8px 0; flex-shrink: 0;"></div>

          <label id="merge-export-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; flex-shrink: 0;">
            <input type="checkbox" id="merge-export-enabled">
            <span>Combinar en archivo único</span>
          </label>
          <div id="merge-filename-container" style="display: none; margin-top: -4px; flex-shrink: 0;">
            <input type="text" id="merge-filename" 
              style="width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"
              placeholder="nombre_del_archivo"
            />
            <div id="merge-filename-preview" style="font-size: 11px; color: #888; margin-top: 4px; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Ej: nombre_pagina_export.md</div>
          </div>

          <div style="height: 1px; background: #e0e0e0; margin: 8px 0; flex-shrink: 0;"></div>

          <label id="order-prefix-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; flex-shrink: 0;">
            <input type="checkbox" id="order-prefix-enabled">
            <span>Agregar prefijo de orden (01_, 02_, ...)</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; padding-left: 24px; opacity: 0.5; margin-top: -6px; flex-shrink: 0;" id="order-descending-label">
            <input type="checkbox" id="order-descending" disabled>
            <span>Orden descendente (..., 02_, 01_)</span>
          </label>

          <div style="height: 1px; background: #e0e0e0; margin: 8px 0; flex-shrink: 0;"></div>

          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; flex-shrink: 0;">
            <input type="checkbox" id="shallow-export-enabled">
            <span>Solo texto visible (sin hijos)</span>
          </label>
          <div id="shallow-export-hint" style="display: none; font-size: 11px; color: #888; padding-left: 24px; margin-top: -4px; flex-shrink: 0;">
            Extrae solo el texto raíz del nodo, sin anidamientos.
          </div>
          
          <div style="height: 1px; background: #e0e0e0; margin: 8px 0; flex-shrink: 0;"></div>

          <!-- Persistent Favorite Tags Manager -->
          <div id="favorite-tags-manager" style="display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
            <span style="font-size: 13px; color: #666; font-weight: 600; display: flex; align-items: center; gap: 4px;">🏷️ Tags Favoritos:</span>
            <div id="fav-tags-list-container" style="
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              max-height: 140px;
              overflow-y: auto;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
              background: #fbfbfb;
              min-height: 48px;
              align-content: flex-start;
            ">
              <!-- Dynamic Chips -->
            </div>
            <div style="display: flex; gap: 6px;">
              <input type="text" id="new-fav-tag-input" 
                style="flex: 1; padding: 6px 10px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; outline: none;"
                placeholder="Agregar tag (ej: resumen)..."
              />
              <button id="add-fav-tag-btn" style="
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid #137CBD;
                border-radius: 4px;
                background: #137CBD;
                color: white;
                cursor: pointer;
                font-weight: bold;
                transition: background 0.2s;
              " onmouseover="this.style.background='#106ba3'" onmouseout="this.style.background='#137CBD'">
                +
              </button>
            </div>
          </div>

          <div style="height: 1px; background: #e0e0e0; margin: 8px 0; flex-shrink: 0;"></div>

          <!-- Format Options (Moved here) -->
          <div id="format-options-container" style="display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
            <div>
              <span style="font-size: 13px; color: #666; display: block; margin-bottom: 6px;">Formato:</span>
              <div id="format-selector" style="display: flex; border-radius: 4px; overflow: hidden; width: fit-content;">
                <button data-format="md" class="format-btn" style="padding: 6px 14px; font-size: 13px; border: 1px solid #137CBD; background: #137CBD; color: white; cursor: pointer; border-radius: 4px 0 0 4px;">Markdown</button>
                <button data-format="epub" class="format-btn" style="padding: 6px 14px; font-size: 13px; border: 1px solid #ccc; border-left: none; background: white; color: #666; cursor: pointer; border-radius: 0 4px 4px 0;">EPUB</button>
              </div>
            </div>
            
            <!-- Markdown Options Panel (visible by default) -->
            <div id="md-options-panel" style="display: block; padding: 8px 12px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
              <span style="font-size: 12px; color: #666; display: block; margin-bottom: 6px;">Estructura:</span>
              <div id="md-structure-selector" style="display: flex; border-radius: 4px; overflow: hidden; width: 100%;">
                <button data-structure="hierarchical" class="active" style="flex: 1; padding: 4px 6px; font-size: 11px; border: 1px solid #137CBD; background: #137CBD; color: white; cursor: pointer; border-radius: 4px 0 0 4px; white-space: nowrap;">Jerárquico</button>
                <button data-structure="flat" style="flex: 1; padding: 4px 6px; font-size: 11px; border: 1px solid #ccc; border-left: none; background: white; color: #666; cursor: pointer; border-radius: 0 4px 4px 0; white-space: nowrap;">Plano</button>
              </div>
            </div>

            <!-- EPUB Options Panel (hidden by default) -->
            <div id="epub-options-panel" style="display: none; padding: 8px 12px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
              <div style="margin-bottom: 8px;">
                <span style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Estructura:</span>
                <div id="epub-structure-selector" style="display: flex; border-radius: 4px; overflow: hidden; width: 100%;">
                  <button data-structure="hierarchical" class="active" style="flex: 1; padding: 4px 6px; font-size: 11px; border: 1px solid #137CBD; background: #137CBD; color: white; cursor: pointer; border-radius: 4px 0 0 4px; white-space: nowrap;">Jerárquico</button>
                  <button data-structure="flat" style="flex: 1; padding: 4px 6px; font-size: 11px; border: 1px solid #ccc; border-left: none; background: white; color: #666; cursor: pointer; border-radius: 0 4px 4px 0; white-space: nowrap;">Plano</button>
                </div>
              </div>
              <div style="margin-bottom: 8px;">
                <span style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Espaciado bloques:</span>
                <div id="block-spacing-selector" style="display: flex; border-radius: 4px; overflow: hidden; width: 100%;">
                  <button data-spacing="compact" style="flex: 1; padding: 4px 4px; font-size: 11px; border: 1px solid #ccc; background: white; color: #666; cursor: pointer; border-radius: 4px 0 0 4px;">Compacto</button>
                  <button data-spacing="normal" class="active" style="flex: 1; padding: 4px 4px; font-size: 11px; border: 1px solid #137CBD; border-left: none; background: #137CBD; color: white; cursor: pointer;">Normal</button>
                  <button data-spacing="wide" style="flex: 1; padding: 4px 4px; font-size: 11px; border: 1px solid #ccc; border-left: none; background: white; color: #666; cursor: pointer; border-radius: 0 4px 4px 0;">Amplio</button>
                </div>
              </div>
              <div style="margin-bottom: 8px;">
                <span style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Al cambiar nivel:</span>
                <div id="level-spacing-selector" style="display: flex; border-radius: 4px; overflow: hidden; width: 100%;">
                  <button data-spacing="none" style="flex: 1; padding: 4px 4px; font-size: 11px; border: 1px solid #ccc; background: white; color: #666; cursor: pointer; border-radius: 4px 0 0 4px;">Ninguno</button>
                  <button data-spacing="subtle" class="active" style="flex: 1; padding: 4px 4px; font-size: 11px; border: 1px solid #137CBD; border-left: none; background: #137CBD; color: white; cursor: pointer;">Sutil</button>
                  <button data-spacing="marked" style="flex: 1; padding: 4px 4px; font-size: 11px; border: 1px solid #ccc; border-left: none; background: white; color: #666; cursor: pointer; border-radius: 0 4px 4px 0;">Marcado</button>
                </div>
              </div>
              <div>
                <span style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Indicador niveles:</span>
                <div id="level-indicator-selector" style="display: flex; border-radius: 4px; overflow: hidden; width: 100%;">
                  <button data-indicator="indent" class="active" style="flex: 1; padding: 4px 4px; font-size: 11px; border: 1px solid #137CBD; background: #137CBD; color: white; cursor: pointer; border-radius: 4px 0 0 4px;">Indentación</button>
                  <button data-indicator="line" style="flex: 1; padding: 4px 4px; font-size: 11px; border: 1px solid #ccc; border-left: none; background: white; color: #666; cursor: pointer;">Línea</button>
                  <button data-indicator="number" style="flex: 1; padding: 4px 4px; font-size: 11px; border: 1px solid #ccc; border-left: none; background: white; color: #666; cursor: pointer; border-radius: 0 4px 4px 0;">Número</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      <!-- Footer -->
      <div style="padding: 16px 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; background: #fafafa; flex-shrink: 0;">
        <span id="selection-info" style="font-size: 13px; color: #666;"></span>
        <div style="display: flex; gap: 8px;">
          <button id="unified-cancel" 
            style="padding: 10px 20px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;">
            Cancelar
          </button>
          <button id="unified-copy-uids" 
            style="padding: 10px 20px; font-size: 14px; border: 1px solid #8A3707; border-radius: 4px; background: white; color: #8A3707; cursor: pointer;"
            title="Copiar referencias de bloques ((uid)) de las ramas seleccionadas">
            🔗 Copiar UIDs
          </button>
          <button id="unified-copy" 
            style="padding: 10px 20px; font-size: 14px; border: 1px solid #137CBD; border-radius: 4px; background: white; color: #137CBD; cursor: pointer;"
            title="Copiar texto markdown de las ramas seleccionadas">
            📋 Copiar Texto
          </button>
          <button id="unified-export" 
            style="padding: 10px 20px; font-size: 14px; border: none; border-radius: 4px; background: #137CBD; color: white; cursor: pointer;">
            Exportar
          </button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Get elements
    const tabBranches = document.getElementById('tab-branches');
    const tabPages = document.getElementById('tab-pages');
    const tabPresets = document.getElementById('tab-presets');
    const contentBranches = document.getElementById('content-branches');
    const contentPages = document.getElementById('content-pages');
    const contentPresets = document.getElementById('content-presets');
    const branchNamingSelector = document.getElementById('branch-naming-selector');
    const branchNamingPreview = document.getElementById('branch-naming-preview');
    const orderPrefixEnabled = document.getElementById('order-prefix-enabled');
    const orderDescending = document.getElementById('order-descending');
    const orderDescendingLabel = document.getElementById('order-descending-label');
    const selectionInfo = document.getElementById('selection-info');
    const cancelBtn = document.getElementById('unified-cancel');
    const copyBtn = document.getElementById('unified-copy');
    const copyUidsBtn = document.getElementById('unified-copy-uids');
    const exportBtn = document.getElementById('unified-export');
    const savePresetBtn = document.getElementById('save-as-preset');
    const shallowExportEnabled = document.getElementById('shallow-export-enabled');
    const shallowExportHint = document.getElementById('shallow-export-hint');
    const treeContainer = document.getElementById('branch-tree-container');
    const mergeExportEnabled = document.getElementById('merge-export-enabled');
    const mergeExportLabel = document.getElementById('merge-export-label');
    const mergeFilenameContainer = document.getElementById('merge-filename-container');
    const mergeFilenameInput = document.getElementById('merge-filename');
    const mergeFilenamePreview = document.getElementById('merge-filename-preview');

    // Pages tab elements
    const pagesListContainer = document.getElementById('pages-list-container');
    const pageFilterEnabled = document.getElementById('page-filter-enabled');
    const pageFilterTag = document.getElementById('page-filter-tag');
    const pageFilterErrorDiv = document.getElementById('page-filter-error');
    const pageSearchInput = document.getElementById('page-search-input');
    const pageSearchBtn = document.getElementById('page-search-btn');

    // Format and EPUB/MD options elements
    const formatSelector = document.getElementById('format-selector');
    const mdOptionsPanel = document.getElementById('md-options-panel');
    const epubOptionsPanel = document.getElementById('epub-options-panel');
    const blockSpacingSelector = document.getElementById('block-spacing-selector');
    const levelSpacingSelector = document.getElementById('level-spacing-selector');
    const levelIndicatorSelector = document.getElementById('level-indicator-selector');
    const mdStructureSelector = document.getElementById('md-structure-selector');
    const epubStructureSelector = document.getElementById('epub-structure-selector');

    let activeTab = 'branches';
    let selectedFormat = 'md'; // 'md' or 'epub'
    let epubOptions = {
      structure: 'hierarchical',
      blockSpacing: 'normal',
      levelSpacing: 'subtle',
      levelIndicator: 'indent'
    };
    let mdOptions = {
      structure: 'hierarchical'
    };

    // Helper to get current Roam graph name
    const getGraphName = () => {
      try {
        if (window.roamAlphaAPI && window.roamAlphaAPI.graph && window.roamAlphaAPI.graph.name) {
          return window.roamAlphaAPI.graph.name;
        }
        const match = window.location.hash.match(/#\/app\/([^/]+)/);
        if (match) {
          return match[1];
        }
      } catch (e) {
        console.error("Error detecting graph name", e);
      }
      return 'default';
    };

    // Presets storage helper (scoped by graph)
    const getSavedPresets = () => {
      const graphName = getGraphName();
      const graphKey = `roam-export-presets-${graphName}`;
      const stored = localStorage.getItem(graphKey);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error("Error reading presets for graph " + graphName, e);
        }
      } else {
        // Migration: check if old key exists
        const legacyStored = localStorage.getItem('roam-export-presets');
        if (legacyStored) {
          try {
            const parsed = JSON.parse(legacyStored);
            // Migrate to graph-scoped storage
            localStorage.setItem(graphKey, legacyStored);
            // Remove legacy storage so it doesn't leak into other graphs
            localStorage.removeItem('roam-export-presets');
            return parsed;
          } catch (e) {
            console.error("Error migrating legacy presets", e);
          }
        }
      }
      return [];
    };

    const savePresets = (presets) => {
      const graphName = getGraphName();
      const graphKey = `roam-export-presets-${graphName}`;
      localStorage.setItem(graphKey, JSON.stringify(presets));
    };

    const getMarkdownForUids = async (uids) => {
      const allSections = [];
      for (const uid of uids) {
        try {
          const branchTree = getBlockWithDescendants(uid);
          if (!branchTree) continue;
          const markdown = treeToMarkdown([branchTree], 0, mdOptions);
          if (markdown) {
            allSections.push(markdown);
          }
        } catch (e) {
          console.error(`Error pulling block for markdown: ${uid}`, e);
        }
      }
      return allSections.join('\n\n');
    };

    // Dialog for saving preset
    const showPresetSaveDialog = (uids, pName, pUid) => {
      const dialogOverlay = document.createElement('div');
      dialogOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.4);
        z-index: 10005;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        width: 380px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      `;

      const count = uids.length;
      
      dialog.innerHTML = `
        <div style="font-weight: bold; font-size: 15px; color: #333;">Guardar Selección como Preset</div>
        <div style="font-size: 13px; color: #666;">Se guardarán ${count} bloques seleccionados de "${pName}".</div>
        <div>
          <label style="display: block; font-size: 12px; color: #555; margin-bottom: 4px;">Nombre del Preset:</label>
          <input type="text" id="preset-name-input" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 13px;" placeholder="Ej: Resumen del Libro...">
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button id="preset-dialog-cancel" style="padding: 6px 12px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;">Cancelar</button>
          <button id="preset-dialog-save" style="padding: 6px 12px; font-size: 13px; border: none; border-radius: 4px; background: #28a745; color: white; cursor: pointer;">Guardar</button>
        </div>
      `;

      dialogOverlay.appendChild(dialog);
      modal.appendChild(dialogOverlay);

      const nameInput = dialogOverlay.querySelector('#preset-name-input');
      nameInput.focus();

      const close = () => {
        if (dialogOverlay.parentNode) {
          dialogOverlay.parentNode.removeChild(dialogOverlay);
        }
      };

      dialogOverlay.querySelector('#preset-dialog-cancel').addEventListener('click', close);

      const doSave = () => {
        const name = nameInput.value.trim();
        if (!name) {
          nameInput.style.borderColor = '#DC143C';
          nameInput.focus();
          return;
        }

        let preview = '';
        try {
          const firstUid = uids[0];
          const blockData = window.roamAlphaAPI.pull('[:block/string]', [':block/uid', firstUid]);
          if (blockData && blockData[':block/string']) {
            const cleanStr = blockData[':block/string'].trim().replace(/[\[\]]/g, '');
            preview = cleanStr.substring(0, 45) + (cleanStr.length > 45 ? '...' : '');
          }
        } catch (e) {
          console.error("Error pulling block preview", e);
        }

        const description = `${count} bloques` + (preview ? ` ("${preview}")` : '');

        const newPreset = {
          id: 'preset_' + Date.now(),
          name,
          description,
          createdAt: new Date().toISOString(),
          pageTitle: pName,
          pageUid: pUid,
          blockUids: [...uids],
          blockCount: count
        };

        const presets = getSavedPresets();
        presets.unshift(newPreset);
        savePresets(presets);

        close();
        showNotification(`✓ Preset "${name}" guardado con éxito`, '#28a745');
      };

      dialogOverlay.querySelector('#preset-dialog-save').addEventListener('click', doSave);
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSave();
        if (e.key === 'Escape') close();
      });
    };

    // Dialog for renaming preset
    const showPresetRenameDialog = (preset) => {
      const dialogOverlay = document.createElement('div');
      dialogOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.4);
        z-index: 10005;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        width: 380px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      `;

      dialog.innerHTML = `
        <div style="font-weight: bold; font-size: 15px; color: #333;">Renombrar Preset</div>
        <div>
          <label style="display: block; font-size: 12px; color: #555; margin-bottom: 4px;">Nombre del Preset:</label>
          <input type="text" id="preset-rename-input" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 13px;" placeholder="Ej: Resumen del Libro...">
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button id="preset-rename-cancel" style="padding: 6px 12px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;">Cancelar</button>
          <button id="preset-rename-save" style="padding: 6px 12px; font-size: 13px; border: none; border-radius: 4px; background: #28a745; color: white; cursor: pointer;">Renombrar</button>
        </div>
      `;

      dialogOverlay.appendChild(dialog);
      modal.appendChild(dialogOverlay);

      const nameInput = dialogOverlay.querySelector('#preset-rename-input');
      nameInput.value = preset.name;
      nameInput.focus();
      nameInput.select();

      const close = () => {
        if (dialogOverlay.parentNode) {
          dialogOverlay.parentNode.removeChild(dialogOverlay);
        }
      };

      dialogOverlay.querySelector('#preset-rename-cancel').addEventListener('click', close);

      const doRename = () => {
        const newName = nameInput.value.trim();
        if (!newName) {
          nameInput.style.borderColor = '#DC143C';
          nameInput.focus();
          return;
        }

        const presets = getSavedPresets();
        const index = presets.findIndex(p => p.id === preset.id);
        if (index !== -1) {
          presets[index].name = newName;
          savePresets(presets);
          showNotification(`✓ Preset renombrado a "${newName}"`, '#28a745');
          renderPresetsList();
        }
        close();
      };

      dialogOverlay.querySelector('#preset-rename-save').addEventListener('click', doRename);
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doRename();
        if (e.key === 'Escape') close();
      });
    };

    // Render presets list
    const renderPresetsList = () => {
      const container = document.getElementById('presets-list-container');
      const presets = getSavedPresets();

      if (presets.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: #999; padding: 40px 20px; font-size: 14px;">
            No tienes presets guardados todavía.<br>
            Ve a la pestaña <b>🌳 Por Ramas</b>, selecciona bloques y haz clic en <b>💾 Guardar Preset</b>.
          </div>
        `;
        return;
      }

      container.innerHTML = presets.map(preset => {
        const dateStr = new Date(preset.createdAt).toLocaleDateString(undefined, {
          day: 'numeric', month: 'short', year: 'numeric'
        });
        const isSamePage = preset.pageUid === pageUid;
        const mergeBtnHtml = isSamePage 
          ? `
              <button class="preset-merge" data-id="${preset.id}" style="
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid #722ed1;
                border-radius: 4px;
                background: white;
                color: #722ed1;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
              " onmouseover="this.style.background='#f9f0ff'" onmouseout="this.style.background='white'">
                🔄 Fusionar
              </button>
            `
          : `
              <button class="preset-merge" data-id="${preset.id}" disabled style="
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid #d9d9d9;
                border-radius: 4px;
                background: #f5f5f5;
                color: #bfbfbf;
                cursor: not-allowed;
                display: flex;
                align-items: center;
                gap: 4px;
              " title="Solo se puede fusionar desde la página de origen del preset (${preset.pageTitle})">
                🔄 Fusionar
              </button>
            `;

        return `
          <div class="preset-item" data-id="${preset.id}" style="
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 14px;
            background: white;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: all 0.2s;
            position: relative;
          " onmouseover="this.style.borderColor='#cbd5e1'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
            <button class="delete-preset-btn" data-id="${preset.id}" style="
              position: absolute;
              top: 10px;
              right: 10px;
              background: none;
              border: none;
              color: #a0aec0;
              cursor: pointer;
              font-size: 16px;
              padding: 4px 8px;
              line-height: 1;
              border-radius: 4px;
            " onmouseover="this.style.color='#e53e3e'; this.style.background='#fff5f5';" onmouseout="this.style.color='#a0aec0'; this.style.background='none';">✕</button>
            
            <div>
              <div style="font-weight: 600; font-size: 14px; color: #2d3748; padding-right: 24px;">📌 ${preset.name}</div>
              <div style="font-size: 12px; color: #718096; margin-top: 4px;">
                ${preset.description} &middot; Origen: <b>${preset.pageTitle}</b> &middot; ${dateStr}
              </div>
            </div>
            
            <div style="display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap;">
              <button class="preset-copy-text" data-id="${preset.id}" style="
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid #137CBD;
                border-radius: 4px;
                background: white;
                color: #137CBD;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
              " onmouseover="this.style.background='#f0f8ff'" onmouseout="this.style.background='white'">
                📋 Copiar Texto
              </button>
              <button class="preset-copy-uids" data-id="${preset.id}" style="
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid #8A3707;
                border-radius: 4px;
                background: white;
                color: #8A3707;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
              " onmouseover="this.style.background='#fffaf0'" onmouseout="this.style.background='white'">
                🔗 Copiar UIDs
              </button>
              <button class="preset-load" data-id="${preset.id}" style="
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid #28a745;
                border-radius: 4px;
                background: white;
                color: #28a745;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
              " onmouseover="this.style.background='#f6fff9'" onmouseout="this.style.background='white'">
                📂 Cargar
              </button>
              <button class="preset-rename" data-id="${preset.id}" style="
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid #5c7080;
                border-radius: 4px;
                background: white;
                color: #5c7080;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
              " onmouseover="this.style.background='#f5f8fa'" onmouseout="this.style.background='white'">
                ✏️ Renombrar
              </button>
              ${mergeBtnHtml}
            </div>
          </div>
        `;
      }).join('');

      // Add event listeners for preset actions
      container.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const name = presets.find(p => p.id === id)?.name || '';
          if (confirm(`¿Estás seguro de que quieres eliminar el preset "${name}"?`)) {
            const updated = getSavedPresets().filter(p => p.id !== id);
            savePresets(updated);
            renderPresetsList();
            showNotification('Preset eliminado', '#718096');
          }
        });
      });

      container.querySelectorAll('.preset-copy-uids').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const preset = presets.find(p => p.id === id);
          if (!preset) return;
          const uidText = preset.blockUids.map(uid => `((${uid}))`).join('\n');
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(uidText)
              .then(() => showNotification(`✓ ${preset.blockUids.length} UIDs copiados`, '#28a745'))
              .catch(() => showNotification('✗ Error al copiar UIDs', '#DC143C'));
          }
        });
      });

      container.querySelectorAll('.preset-copy-text').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const preset = presets.find(p => p.id === id);
          if (!preset) return;

          showNotification('Procesando bloques...', '#137CBD');
          
          try {
            const markdown = await getMarkdownForUids(preset.blockUids);
            if (!markdown) {
              showNotification('⚠️ Bloques vacíos o ya no existen', '#e0a800');
              return;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(markdown)
                .then(() => showNotification(`✓ Texto copiado (${preset.blockUids.length} bloques)`, '#28a745'))
                .catch(() => showNotification('✗ Error al copiar', '#DC143C'));
            }
          } catch (e) {
            console.error(e);
            showNotification('✗ Error al procesar bloques', '#DC143C');
          }
        });
      });

      container.querySelectorAll('.preset-load').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const preset = presets.find(p => p.id === id);
          if (!preset) return;

          if (preset.pageUid === pageUid) {
            switchTab('branches');
            treeContainer.querySelectorAll('.branch-checkbox').forEach(cb => {
              cb.checked = false;
              cb.indeterminate = false;
            });

            let markedCount = 0;
            preset.blockUids.forEach(uid => {
              const cb = treeContainer.querySelector(`.branch-checkbox[data-uid="${uid}"]`);
              if (cb) {
                cb.checked = true;
                markedCount++;
                
                const container = cb.closest('.tree-node');
                if (container) {
                  const descendantCheckboxes = container.querySelectorAll('.branch-checkbox');
                  descendantCheckboxes.forEach(childCb => {
                    childCb.checked = true;
                    childCb.indeterminate = false;
                  });

                  let parentContainer = container.parentElement.closest('.tree-node');
                  while (parentContainer) {
                    const parentCb = parentContainer.querySelector('.branch-checkbox');
                    if (parentCb) {
                      const allDescendants = Array.from(parentContainer.querySelectorAll('.branch-checkbox')).filter(c => c !== parentCb);
                      if (allDescendants.length > 0) {
                        const allChecked = allDescendants.every(c => c.checked);
                        const someChecked = allDescendants.some(c => c.checked || c.indeterminate);
                        if (allChecked) {
                          parentCb.checked = true;
                          parentCb.indeterminate = false;
                        } else if (someChecked) {
                          parentCb.checked = false;
                          parentCb.indeterminate = true;
                        } else {
                          parentCb.checked = false;
                          parentCb.indeterminate = false;
                        }
                      }
                    }
                    parentContainer = parentContainer.parentElement.closest('.tree-node');
                  }
                }
              }
            });

            updateBranchCount();
            updateSelectAllLabel();
            showNotification(`✓ Cargados ${markedCount} de ${preset.blockUids.length} bloques`, '#28a745');
          } else {
            if (confirm(`Este preset es de la página "${preset.pageTitle}". ¿Quieres navegar a esa página para cargarlo?`)) {
              cleanup();
              if (window.roamAlphaAPI && window.roamAlphaAPI.ui && window.roamAlphaAPI.ui.mainWindow) {
                window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: preset.pageUid } });
                
                sessionStorage.setItem('roam-export-auto-load-preset', JSON.stringify({
                  presetId: preset.id,
                  pageUid: preset.pageUid
                }));

                setTimeout(() => {
                  unifiedExport();
                }, 1000);
              } else {
                showNotification('No se pudo navegar automáticamente', '#DC143C');
              }
            }
          }
        });
      });

      container.querySelectorAll('.preset-rename').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const preset = presets.find(p => p.id === id);
          if (preset) {
            showPresetRenameDialog(preset);
          }
        });
      });

      container.querySelectorAll('.preset-merge').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const preset = presets.find(p => p.id === id);
          if (!preset) return;

          const selectedUids = getSelectedBranchUids();
          if (selectedUids.length === 0) {
            alert('Por favor selecciona al menos un bloque en el árbol para fusionar con este preset.');
            return;
          }

          const currentUidsSet = new Set(preset.blockUids);
          const newUids = selectedUids.filter(uid => !currentUidsSet.has(uid));

          if (newUids.length === 0) {
            showNotification('Todos los bloques seleccionados ya están en este preset', '#e0a800');
            return;
          }

          if (confirm(`¿Estás seguro de que quieres añadir ${newUids.length} bloques nuevos al preset "${preset.name}"?`)) {
            const mergedUids = [...preset.blockUids, ...newUids];
            
            let preview = '';
            try {
              const firstUid = mergedUids[0];
              const blockData = window.roamAlphaAPI.pull('[:block/string]', [':block/uid', firstUid]);
              if (blockData && blockData[':block/string']) {
                const cleanStr = blockData[':block/string'].trim().replace(/[\[\]]/g, '');
                preview = cleanStr.substring(0, 45) + (cleanStr.length > 45 ? '...' : '');
              }
            } catch (e) {
              console.error("Error pulling block preview", e);
            }

            const updatedPresets = getSavedPresets();
            const idx = updatedPresets.findIndex(p => p.id === preset.id);
            if (idx !== -1) {
              updatedPresets[idx].blockUids = mergedUids;
              updatedPresets[idx].blockCount = mergedUids.length;
              updatedPresets[idx].description = `${mergedUids.length} bloques` + (preview ? ` ("${preview}")` : '');
              updatedPresets[idx].createdAt = new Date().toISOString();
              savePresets(updatedPresets);
              showNotification(`✓ Se añadieron ${newUids.length} bloques al preset "${preset.name}"`, '#28a745');
              renderPresetsList();
            }
          }
        });
      });
    };

    // Tab switching
    const pageNameDisplay = document.getElementById('page-name-display');
    const switchTab = (tab) => {
      activeTab = tab;
      // Reset all tabs
      tabBranches.style.cssText = tabStyle(false);
      tabPages.style.cssText = tabStyle(false);
      tabPresets.style.cssText = tabStyle(false);
      contentBranches.style.display = 'none';
      contentPages.style.display = 'none';
      contentPresets.style.display = 'none';
      selectionInfo.textContent = '';

      if (tab === 'branches') {
        tabBranches.style.cssText = tabStyle(true);
        contentBranches.style.display = 'flex';
        pageNameDisplay.style.display = '';
        updateBranchCount();
        copyBtn.style.display = '';
        copyUidsBtn.style.display = '';
        exportBtn.style.display = '';
      } else if (tab === 'pages') {
        tabPages.style.cssText = tabStyle(true);
        contentPages.style.display = 'flex';
        pageNameDisplay.style.display = 'none';
        if (window._updatePageCount) window._updatePageCount();
        copyBtn.style.display = '';
        copyUidsBtn.style.display = '';
        exportBtn.style.display = '';
      } else if (tab === 'presets') {
        tabPresets.style.cssText = tabStyle(true);
        contentPresets.style.display = 'flex';
        pageNameDisplay.style.display = 'none';
        copyBtn.style.display = 'none';
        copyUidsBtn.style.display = 'none';
        exportBtn.style.display = 'none';
        renderPresetsList();
      }
    };

    tabBranches.addEventListener('click', () => switchTab('branches'));
    tabPages.addEventListener('click', () => switchTab('pages'));
    tabPresets.addEventListener('click', () => switchTab('presets'));

    // Depth selector logic
    const depthSelector = document.getElementById('depth-selector');
    const updateDepth = (newDepth) => {
      if (newDepth === currentDepth) return;
      currentDepth = newDepth;

      // Update button styles
      depthSelector.querySelectorAll('button').forEach(btn => {
        const d = parseInt(btn.dataset.depth);
        const isFirst = d === 1;
        const isLast = d === 4;
        const isActive = d === currentDepth;
        btn.style.cssText = `
          padding: 6px 12px;
          font-size: 13px;
          border: 1px solid ${isActive ? '#137CBD' : '#ccc'};
          background: ${isActive ? '#137CBD' : 'white'};
          color: ${isActive ? 'white' : '#666'};
          cursor: pointer;
          transition: all 0.2s;
          ${isFirst ? 'border-radius: 4px 0 0 4px;' : ''}
          ${isLast ? 'border-radius: 0 4px 4px 0;' : ''}
          ${!isFirst ? 'border-left: none;' : ''}
        `;
      });

      // Re-fetch structure with new depth and re-render tree
      structure = getPageStructure(pageUid, currentDepth);
      treeContainer.innerHTML = renderTree(structure);

      // Re-attach checkbox listeners
      treeContainer.querySelectorAll('.branch-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const isChecked = e.target.checked;
          const container = e.target.closest('.tree-node');
          
          if (container) {
            // 1. Cascada hacia abajo
            const descendantCheckboxes = container.querySelectorAll('.branch-checkbox');
            descendantCheckboxes.forEach(childCb => {
              childCb.checked = isChecked;
              childCb.indeterminate = false;
            });
            
            // 2. Cascada hacia arriba
            let parentContainer = container.parentElement.closest('.tree-node');
            while (parentContainer) {
              const parentCb = parentContainer.querySelector('.branch-checkbox');
              if (parentCb) {
                const allDescendants = Array.from(parentContainer.querySelectorAll('.branch-checkbox')).filter(c => c !== parentCb);
                if (allDescendants.length > 0) {
                  const allChecked = allDescendants.every(c => c.checked);
                  const someChecked = allDescendants.some(c => c.checked || c.indeterminate);
                  if (allChecked) {
                    parentCb.checked = true;
                    parentCb.indeterminate = false;
                  } else if (someChecked) {
                    parentCb.checked = false;
                    parentCb.indeterminate = true;
                  } else {
                    parentCb.checked = false;
                    parentCb.indeterminate = false;
                  }
                }
              }
              parentContainer = parentContainer.parentElement.closest('.tree-node');
            }
          }
          
          updateBranchCount();
          updateSelectAllLabel();
        });
      });

      updateBranchCount();
      updateSelectAllLabel();
    };

    depthSelector.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => updateDepth(parseInt(btn.dataset.depth)));
    });

    // Update branch selection count
    const updateBranchCount = () => {
      const checked = treeContainer.querySelectorAll('.branch-checkbox:checked');
      const count = checked.length;
      selectionInfo.textContent = `${count} rama${count !== 1 ? 's' : ''} seleccionada${count !== 1 ? 's' : ''}`;
    };

    // Select All / Deselect All logic
    const selectAllBtn = document.getElementById('select-all-branches');
    const filterErrorDiv = document.getElementById('branch-filter-error');

    const updateSelectAllLabel = () => {
      const allCheckboxes = treeContainer.querySelectorAll('.branch-checkbox');
      const checkedBoxes = treeContainer.querySelectorAll('.branch-checkbox:checked');
      const allSelected = allCheckboxes.length > 0 && allCheckboxes.length === checkedBoxes.length;
      selectAllBtn.textContent = allSelected ? '☐ Deseleccionar todo' : '☑ Seleccionar todo';
    };

    selectAllBtn.addEventListener('click', () => {
      const allCheckboxes = treeContainer.querySelectorAll('.branch-checkbox');
      const checkedBoxes = treeContainer.querySelectorAll('.branch-checkbox:checked');
      const shouldSelect = checkedBoxes.length < allCheckboxes.length;
      allCheckboxes.forEach(cb => { 
        cb.checked = shouldSelect; 
        cb.indeterminate = false;
      });
      updateBranchCount();
      updateSelectAllLabel();
    });

    // Add event listeners to branch checkboxes
    treeContainer.querySelectorAll('.branch-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const container = e.target.closest('.tree-node');
        
        if (container) {
          // 1. Cascada hacia abajo
          const descendantCheckboxes = container.querySelectorAll('.branch-checkbox');
          descendantCheckboxes.forEach(childCb => {
            childCb.checked = isChecked;
            childCb.indeterminate = false;
          });
          
          // 2. Cascada hacia arriba
          let parentContainer = container.parentElement.closest('.tree-node');
          while (parentContainer) {
            const parentCb = parentContainer.querySelector('.branch-checkbox');
            if (parentCb) {
              const allDescendants = Array.from(parentContainer.querySelectorAll('.branch-checkbox')).filter(c => c !== parentCb);
              if (allDescendants.length > 0) {
                const allChecked = allDescendants.every(c => c.checked);
                const someChecked = allDescendants.some(c => c.checked || c.indeterminate);
                if (allChecked) {
                  parentCb.checked = true;
                  parentCb.indeterminate = false;
                } else if (someChecked) {
                  parentCb.checked = false;
                  parentCb.indeterminate = true;
                } else {
                  parentCb.checked = false;
                  parentCb.indeterminate = false;
                }
              }
            }
            parentContainer = parentContainer.parentElement.closest('.tree-node');
          }
        }
        
        updateBranchCount();
        updateSelectAllLabel();
      });
    });

    // Toggle individual branches using event delegation
    treeContainer.addEventListener('click', (e) => {
      const toggle = e.target.closest('.tree-toggle');
      if (!toggle) return;

      const uid = toggle.dataset.uid;
      const nodeRow = toggle.closest('.tree-node');
      const childrenDiv = nodeRow.querySelector(`.tree-children[data-parent-uid="${uid}"]`);

      if (childrenDiv) {
        const isExpanded = childrenDiv.style.display !== 'none';
        childrenDiv.style.display = isExpanded ? 'none' : 'block';
        toggle.textContent = isExpanded ? '▶' : '▼';
      }
    });

    // Expand / Collapse all logic
    const expandAllBtn = document.getElementById('expand-all-branches');
    const collapseAllBtn = document.getElementById('collapse-all-branches');

    if (expandAllBtn && collapseAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        treeContainer.querySelectorAll('.tree-children').forEach(div => {
          div.style.display = 'block';
        });
        treeContainer.querySelectorAll('.tree-toggle').forEach(t => {
          t.textContent = '▼';
        });
      });

      collapseAllBtn.addEventListener('click', () => {
        treeContainer.querySelectorAll('.tree-children').forEach(div => {
          div.style.display = 'none';
        });
        treeContainer.querySelectorAll('.tree-toggle').forEach(t => {
          t.textContent = '▶';
        });
      });
    }

    // === Interactive Search & Filtering logic for Branch Tree ===
    const branchSearchInput = document.getElementById('branch-tree-search');
    const clearSearchBtn = document.getElementById('clear-branch-search');
    const selectMatchingBtn = document.getElementById('select-matching-btn');
    const branchFavTags = document.getElementById('branch-fav-tags');

    // Accent normalization helper
    const normalizeText = (text) => {
      if (!text) return '';
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[#\[\]]/g, '') // remove Roam tag brackets and hash
        .trim();
    };

    // Helper to highlight matching text inside a text span without breaking sub-spans (like .tree-deep-info)
    const highlightSpanText = (span, query) => {
      // Restore original HTML if stored
      if (span.hasAttribute('data-original-html')) {
        span.innerHTML = span.getAttribute('data-original-html');
      } else {
        // Store it for future restores
        span.setAttribute('data-original-html', span.innerHTML);
      }

      if (!query) return;

      const normQuery = normalizeText(query);
      if (!normQuery) return;

      // We want to highlight only the text content before any nested elements (like tree-deep-info)
      // Since renderTree returns: <span class="node-text-span">${node.content}${deepInfo}</span>
      const childNodes = Array.from(span.childNodes);
      for (const node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          const normText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          
          let index = normText.indexOf(normQuery);
          if (index !== -1) {
            const parent = node.parentNode;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            
            while (index !== -1) {
              // Find start and end in original text using character normalization mapping
              let queryIdx = 0;
              let matchStart = -1;
              let matchEnd = -1;
              for (let i = lastIndex; i < text.length; i++) {
                const normChar = text[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (normChar === normQuery[queryIdx]) {
                  if (queryIdx === 0) matchStart = i;
                  queryIdx++;
                  if (queryIdx === normQuery.length) {
                    matchEnd = i + 1;
                    break;
                  }
                } else {
                  if (queryIdx > 0) {
                    i = matchStart; // backtrack
                    queryIdx = 0;
                    matchStart = -1;
                  }
                }
              }
              
              if (matchStart !== -1 && matchEnd !== -1) {
                // Add part before match
                if (matchStart > lastIndex) {
                  fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchStart)));
                }
                // Add matched part inside <mark>
                const mark = document.createElement('mark');
                mark.className = 'search-highlight';
                mark.style.cssText = 'background-color: #fef08a; color: #1f2937; padding: 0 2px; border-radius: 2px; font-weight: bold;';
                mark.textContent = text.substring(matchStart, matchEnd);
                fragment.appendChild(mark);
                
                lastIndex = matchEnd;
                
                const remainingText = text.substring(lastIndex);
                const remainingNorm = remainingText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                index = remainingNorm.indexOf(normQuery);
              } else {
                break;
              }
            }
            
            if (lastIndex < text.length) {
              fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            
            parent.replaceChild(fragment, node);
          }
        }
      }
    };

    // Tree filtering function
    const filterTreeUI = (query) => {
      const normQuery = normalizeText(query);
      
      if (!normQuery) {
        // Reset everything
        clearSearchBtn.style.display = 'none';
        selectMatchingBtn.style.display = 'none';
        
        treeContainer.querySelectorAll('.tree-node').forEach(node => {
          node.style.display = 'block';
          const childrenDiv = node.querySelector('.tree-children');
          if (childrenDiv) {
            childrenDiv.style.display = 'none';
          }
          const toggle = node.querySelector('.tree-toggle');
          if (toggle) toggle.textContent = '▶';
          
          // Restore text spans
          const textSpan = node.querySelector('.node-text-span');
          if (textSpan && textSpan.hasAttribute('data-original-html')) {
            textSpan.innerHTML = textSpan.getAttribute('data-original-html');
          }
        });
        return;
      }
      
      clearSearchBtn.style.display = 'inline-block';
      selectMatchingBtn.style.display = 'inline-block';
      
      const allNodes = Array.from(treeContainer.querySelectorAll('.tree-node'));
      const reversedNodes = allNodes.slice().reverse();
      const nodesWithMatchingDescendants = new Set();
      const directMatches = new Set();
      
      // First pass bottom-up: determine matching nodes
      reversedNodes.forEach(node => {
        const textSpan = node.querySelector('.node-text-span');
        if (!textSpan) return;
        
        highlightSpanText(textSpan, query);
        
        const titleText = textSpan.textContent || '';
        const normTitleText = normalizeText(titleText);
        
        const isDirectMatch = normTitleText.includes(normQuery);
        const hasMatchingDescendant = Array.from(node.querySelectorAll('.tree-node')).some(childNode => {
          const childUid = childNode.querySelector('.branch-checkbox')?.dataset.uid;
          return directMatches.has(childUid) || nodesWithMatchingDescendants.has(childUid);
        });
        
        const uid = node.querySelector('.branch-checkbox')?.dataset.uid;
        if (uid) {
          if (isDirectMatch) directMatches.add(uid);
          if (hasMatchingDescendant) nodesWithMatchingDescendants.add(uid);
        }
      });
      
      // Second pass top-down: display matched/related branches
      allNodes.forEach(node => {
        const uid = node.querySelector('.branch-checkbox')?.dataset.uid;
        const isDirectMatch = directMatches.has(uid);
        const hasMatchingDescendant = nodesWithMatchingDescendants.has(uid);
        
        if (isDirectMatch || hasMatchingDescendant) {
          node.style.display = 'block';
          
          const childrenDiv = node.querySelector('.tree-children');
          if (childrenDiv && hasMatchingDescendant) {
            childrenDiv.style.display = 'block';
            const toggle = node.querySelector('.tree-toggle');
            if (toggle) toggle.textContent = '▼';
          }
        } else {
          node.style.display = 'none';
        }
      });
    };

    // Select all visible direct matches
    const selectMatchingNodes = () => {
      const query = branchSearchInput.value;
      const normQuery = normalizeText(query);
      if (!normQuery) return;
      
      let selectedCount = 0;
      
      const allNodes = treeContainer.querySelectorAll('.tree-node');
      allNodes.forEach(node => {
        if (node.style.display === 'none') return;
        
        const checkbox = node.querySelector('.branch-checkbox');
        if (!checkbox) return;
        
        const textSpan = node.querySelector('.node-text-span');
        if (!textSpan) return;
        
        const titleText = textSpan.textContent || '';
        const normTitleText = normalizeText(titleText);
        
        if (normTitleText.includes(normQuery)) {
          if (!checkbox.checked) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
            selectedCount++;
          }
        }
      });
      
      if (selectedCount > 0) {
        showNotification(`✓ Marcadas ${selectedCount} coincidencias`, '#137CBD');
      } else {
        showNotification('No hay nuevas coincidencias para seleccionar', '#888');
      }
    };

    // Bind search input events
    branchSearchInput.addEventListener('input', (e) => {
      filterTreeUI(e.target.value);
    });

    clearSearchBtn.addEventListener('click', () => {
      branchSearchInput.value = '';
      filterTreeUI('');
    });

    selectMatchingBtn.addEventListener('click', selectMatchingNodes);

    // Persistent Dynamic Favorite Tags Manager Logic
    const renderFavoriteTags = () => {
      const tags = getFavoriteTags();
      const container = document.getElementById('fav-tags-list-container');
      if (!container) return;

      if (tags.length === 0) {
        container.innerHTML = '<span style="font-size: 11px; color: #888; padding: 4px; font-style: italic;">No hay tags favoritos</span>';
        return;
      }

      container.innerHTML = tags.map(tag => `
        <span class="fav-tag-chip" data-tag="${tag}" style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: #e8f4fc;
          color: #137CBD;
          border-radius: 12px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          user-select: none;
        ">
          <span class="chip-text">#${tag}</span>
          <span class="remove-fav-tag" data-tag="${tag}" style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            color: #a0aec0;
            font-size: 10px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
          " title="Eliminar">✕</span>
        </span>
      `).join('');

      // Bind dynamic chip events
      container.querySelectorAll('.fav-tag-chip').forEach(chip => {
        const tag = chip.dataset.tag;
        
        // Chip text click triggers search
        chip.querySelector('.chip-text').addEventListener('click', (e) => {
          e.stopPropagation();
          branchSearchInput.value = '#' + tag;
          filterTreeUI('#' + tag);
          branchSearchInput.focus();
        });

        // Chip delete click
        chip.querySelector('.remove-fav-tag').addEventListener('click', (e) => {
          e.stopPropagation();
          let tags = getFavoriteTags();
          tags = tags.filter(t => t !== tag);
          saveFavoriteTags(tags);
          renderFavoriteTags();
        });
      });
    };

    // Add tag button click / enter keypress
    const addBtn = document.getElementById('add-fav-tag-btn');
    const addInput = document.getElementById('new-fav-tag-input');

    if (addBtn && addInput) {
      const addNewFavorite = () => {
        const val = addInput.value.trim().replace(/[#\[\]]/g, '');
        if (val) {
          const tags = getFavoriteTags();
          if (!tags.includes(val)) {
            tags.push(val);
            saveFavoriteTags(tags);
            renderFavoriteTags();
          }
          addInput.value = '';
        }
      };

      addBtn.addEventListener('click', addNewFavorite);
      addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addNewFavorite();
        }
      });
    }

    // Initial render of favorite tags
    renderFavoriteTags();

    // Branch Naming logic
    let branchNamingStrategy = 'block'; // default
    const updateNamingPreview = () => {
      if (!branchNamingPreview) return;
      let prefix = orderPrefixEnabled.checked ? (orderDescending.checked ? '02_' : '01_') : '';
      let safePage = generatePageFilename(pageName);
      let previewText = '';
      if (branchNamingStrategy === 'block') {
        previewText = prefix + 'mi_bloque.md';
      } else if (branchNamingStrategy === 'page_block') {
        previewText = prefix + safePage + '_mi_bloque.md';
      } else if (branchNamingStrategy === 'page') {
        previewText = prefix + safePage + '.md';
      }
      branchNamingPreview.textContent = 'Ej: ' + previewText;
    };

    if (branchNamingSelector) {
      branchNamingSelector.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          branchNamingStrategy = btn.dataset.naming;

          // Update active styles
          const buttons = branchNamingSelector.querySelectorAll('button');
          buttons.forEach((b, idx) => {
            const isActive = b.dataset.naming === branchNamingStrategy;
            const isFirst = idx === 0;
            const isLast = idx === buttons.length - 1;
            b.style.cssText = `
              padding: 4px 10px;
              font-size: 12px;
              border: 1px solid ${isActive ? '#137CBD' : '#ccc'};
              ${!isFirst ? 'border-left: none;' : ''}
              background: ${isActive ? '#137CBD' : 'white'};
              color: ${isActive ? 'white' : '#666'};
              cursor: pointer;
              ${isFirst ? 'border-radius: 4px 0 0 4px;' : ''}
              ${isLast ? 'border-radius: 0 4px 4px 0;' : ''}
            `;
          });
          updateNamingPreview();
        });
      });
    }

    // Initialize preview
    updateNamingPreview();

    // Merge export toggle - combines all branches into a single file
    mergeExportEnabled.addEventListener('change', () => {
      const isMerge = mergeExportEnabled.checked;

      // Show/hide merge filename input
      mergeFilenameContainer.style.display = isMerge ? 'block' : 'none';

      // Disable naming options when merging (not needed for single file)
      branchNamingSelector.style.opacity = isMerge ? '0.4' : '1';
      branchNamingSelector.style.pointerEvents = isMerge ? 'none' : 'auto';
      branchNamingPreview.style.display = isMerge ? 'none' : 'block';

      // Disable order prefix when merging
      const orderPrefixLabel = document.getElementById('order-prefix-label');
      orderPrefixEnabled.disabled = isMerge;
      if (orderPrefixLabel) orderPrefixLabel.style.opacity = isMerge ? '0.4' : '1';
      orderDescendingLabel.style.opacity = isMerge ? '0.4' : '0.5';
      if (isMerge) {
        orderPrefixEnabled.checked = false;
        orderDescending.disabled = true;
        orderDescending.checked = false;
      }

      if (isMerge) {
        // Pre-fill with page name
        mergeFilenameInput.value = generatePageFilename(pageName) + '_export';
        mergeFilenamePreview.textContent = 'Ej: ' + generatePageFilename(pageName) + '_export.md';
      }
    });

    // Update merge filename preview on input
    mergeFilenameInput.addEventListener('input', () => {
      const val = mergeFilenameInput.value.trim() || generatePageFilename(pageName) + '_export';
      mergeFilenamePreview.textContent = 'Ej: ' + val + '.md';
    });

    // Order prefix toggle - enables/disables descending option
    orderPrefixEnabled.addEventListener('change', () => {
      orderDescending.disabled = !orderPrefixEnabled.checked;
      orderDescendingLabel.style.opacity = orderPrefixEnabled.checked ? '1' : '0.5';
      if (!orderPrefixEnabled.checked) {
        orderDescending.checked = false;
      }
      updateNamingPreview();
    });

    orderDescending.addEventListener('change', updateNamingPreview);



    // === Pages tab event listeners ===
    // Update page selection count
    const updatePageCount = () => {
      const checked = pagesListContainer.querySelectorAll('.page-checkbox:checked');
      const count = checked.length;
      selectionInfo.textContent = `${count} página${count !== 1 ? 's' : ''} seleccionada${count !== 1 ? 's' : ''}`;
    };

    // Select All / Deselect All for pages
    const selectAllPagesBtn = document.getElementById('select-all-pages');
    const updateSelectAllPagesLabel = () => {
      const allCheckboxes = pagesListContainer.querySelectorAll('.page-checkbox');
      const checkedBoxes = pagesListContainer.querySelectorAll('.page-checkbox:checked');
      const allSelected = allCheckboxes.length > 0 && allCheckboxes.length === checkedBoxes.length;
      selectAllPagesBtn.textContent = allSelected ? '☐ Deseleccionar todo' : '☑ Seleccionar todo';
    };

    selectAllPagesBtn.addEventListener('click', () => {
      const allCheckboxes = pagesListContainer.querySelectorAll('.page-checkbox');
      const checkedBoxes = pagesListContainer.querySelectorAll('.page-checkbox:checked');
      const shouldSelect = checkedBoxes.length < allCheckboxes.length;
      allCheckboxes.forEach(cb => { cb.checked = shouldSelect; });
      updatePageCount();
      updateSelectAllPagesLabel();
    });

    // Helper to attach checkbox listeners for pages
    const attachPageCheckboxListeners = () => {
      pagesListContainer.querySelectorAll('.page-checkbox').forEach(cb => {
        cb.addEventListener('change', () => { updatePageCount(); updateSelectAllPagesLabel(); });
      });
    };
    attachPageCheckboxListeners(); // Attach for initial child pages (if any)

    // Page search functionality
    const doPageSearch = () => {
      const searchTerm = pageSearchInput.value.trim();
      if (searchTerm.length < 2) {
        pageFilterErrorDiv.textContent = '⚠ Escribe al menos 2 caracteres para buscar';
        pageFilterErrorDiv.style.display = 'block';
        pageFilterErrorDiv.style.background = '#fff8e6';
        pageFilterErrorDiv.style.borderColor = '#e6a817';
        pageFilterErrorDiv.style.color = '#996600';
        return;
      }
      pageFilterErrorDiv.style.display = 'none';

      // Remember currently checked pages
      const checkedUids = new Set();
      pagesListContainer.querySelectorAll('.page-checkbox:checked').forEach(cb => {
        checkedUids.add(cb.dataset.uid);
      });

      const results = searchPages(searchTerm);
      if (results.length === 0) {
        pagesListContainer.innerHTML = '<p style="color: #888; padding: 12px;">No se encontraron páginas</p>';
        return;
      }

      // Merge: keep checked pages at top, add new results
      const seenUids = new Set();
      let mergedPages = [];

      // First add previously checked pages that are still relevant
      pagesListContainer.querySelectorAll('.page-checkbox:checked').forEach(cb => {
        if (!seenUids.has(cb.dataset.uid)) {
          seenUids.add(cb.dataset.uid);
          mergedPages.push({ uid: cb.dataset.uid, title: cb.dataset.title, shortName: cb.dataset.short });
        }
      });

      // Then add search results (excluding already added)
      for (const page of results) {
        if (!seenUids.has(page.uid)) {
          seenUids.add(page.uid);
          mergedPages.push(page);
        }
      }

      pagesListContainer.innerHTML = renderPagesList(mergedPages);

      // Re-check previously checked pages
      pagesListContainer.querySelectorAll('.page-checkbox').forEach(cb => {
        if (checkedUids.has(cb.dataset.uid)) cb.checked = true;
      });

      attachPageCheckboxListeners();
      updatePageCount();
      updateSelectAllPagesLabel();
    };

    pageSearchBtn.addEventListener('click', doPageSearch);
    pageSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        doPageSearch();
      }
    });

    // Page filter toggle
    pageFilterEnabled.addEventListener('change', () => {
      pageFilterTag.disabled = !pageFilterEnabled.checked;
      pageFilterTag.style.opacity = pageFilterEnabled.checked ? '1' : '0.5';
      if (pageFilterEnabled.checked) {
        pageFilterTag.focus();
      } else {
        pageFilterErrorDiv.style.display = 'none';
        pageFilterTag.style.borderColor = '#ccc';
      }
    });

    // Clear error state when user types in page filter tag
    pageFilterTag.addEventListener('input', () => {
      pageFilterErrorDiv.style.display = 'none';
      pageFilterTag.style.borderColor = '#ccc';
    });

    // Make updatePageCount accessible from switchTab
    window._updatePageCount = updatePageCount;

    // Format selector logic
    const updateFormatButtonStyles = () => {
      formatSelector.querySelectorAll('.format-btn').forEach(btn => {
        const isActive = btn.dataset.format === selectedFormat;
        btn.style.cssText = `
          padding: 6px 14px;
          font-size: 13px;
          border: 1px solid ${isActive ? '#137CBD' : '#ccc'};
          ${btn.dataset.format === 'epub' ? 'border-left: none;' : ''}
          background: ${isActive ? '#137CBD' : 'white'};
          color: ${isActive ? 'white' : '#666'};
          cursor: pointer;
        `;
      });
      // Show/hide options panel based on format
      mdOptionsPanel.style.display = selectedFormat === 'md' ? 'block' : 'none';
      epubOptionsPanel.style.display = selectedFormat === 'epub' ? 'block' : 'none';
    };

    formatSelector.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedFormat = btn.dataset.format;
        updateFormatButtonStyles();
        // EPUB always generates a single file, so hide merge option for EPUB
        if (mergeExportLabel) {
          if (selectedFormat === 'epub') {
            mergeExportLabel.style.display = 'none';
            mergeFilenameContainer.style.display = 'none';
            mergeExportEnabled.checked = false;
            // Re-enable naming/order prefix
            branchNamingSelector.style.opacity = '1';
            branchNamingSelector.style.pointerEvents = 'auto';
            branchNamingPreview.style.display = 'block';
            orderPrefixEnabled.disabled = false;
            const orderPrefixLabel = document.getElementById('order-prefix-label');
            if (orderPrefixLabel) orderPrefixLabel.style.opacity = '1';
          } else {
            mergeExportLabel.style.display = 'flex';
          }
        }
      });
    });

    // Options selector helper
    const setupOptionSelector = (selector, optionsObj, optionKey) => {
      if (!selector) return;
      const updateStyles = () => {
        selector.querySelectorAll('button').forEach((btn, idx) => {
          const value = btn.dataset.spacing || btn.dataset.indicator || btn.dataset.structure;
          const isActive = optionsObj[optionKey] === value;
          const isFirst = idx === 0;
          const isLast = idx === selector.querySelectorAll('button').length - 1;
          btn.style.cssText = `
            padding: 4px 10px;
            font-size: 12px;
            border: 1px solid ${isActive ? '#137CBD' : '#ccc'};
            ${!isFirst ? 'border-left: none;' : ''}
            background: ${isActive ? '#137CBD' : 'white'};
            color: ${isActive ? 'white' : '#666'};
            cursor: pointer;
            ${isFirst ? 'border-radius: 4px 0 0 4px;' : ''}
            ${isLast ? 'border-radius: 0 4px 4px 0;' : ''}
          `;
        });
      };

      selector.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          optionsObj[optionKey] = btn.dataset.spacing || btn.dataset.indicator || btn.dataset.structure;
          updateStyles();
        });
      });
    };

    setupOptionSelector(blockSpacingSelector, epubOptions, 'blockSpacing');
    setupOptionSelector(levelSpacingSelector, epubOptions, 'levelSpacing');
    setupOptionSelector(levelIndicatorSelector, epubOptions, 'levelIndicator');
    setupOptionSelector(epubStructureSelector, epubOptions, 'structure');
    setupOptionSelector(mdStructureSelector, mdOptions, 'structure');

    function cleanup() {
      document.body.removeChild(overlay);
      document.removeEventListener('keydown', handleKeydown);
    }

    const getSelectedBranchUids = () => {
      const checked = treeContainer.querySelectorAll('.branch-checkbox:checked');
      return Array.from(checked).map(cb => cb.dataset.uid);
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve({ cancelled: true });
    });

    // Hint toggle for shallow export
    shallowExportEnabled.addEventListener('change', () => {
      shallowExportHint.style.display = shallowExportEnabled.checked ? 'block' : 'none';
    });

    const triggerAction = (action) => {
      if (activeTab === 'filters') {
        const tagValue = tagInput.value.trim();
        if (!tagValue) {
          tagInput.style.borderColor = '#DC143C';
          tagInput.focus();
          return;
        }
        cleanup();
        resolve({
          cancelled: false,
          mode: 'filters',
          tagName: cleanTagInput(tagValue),
          format: selectedFormat,
          action: action,
          epubOptions: { ...epubOptions },
          mdOptions: { ...mdOptions }
        });
      } else if (activeTab === 'branches') {
        const selectedUids = getSelectedBranchUids();
        if (selectedUids.length === 0) {
          alert('Por favor selecciona al menos una rama para procesar.');
          return;
        }

        // Hide any previous error
        filterErrorDiv.style.display = 'none';

        // Validate filterTag BEFORE closing modal
        let validatedFilterTag = null;

        cleanup();
        resolve({
          cancelled: false,
          mode: 'branches',
          selectedUids,
          filterTag: validatedFilterTag,
          useOrderPrefix: orderPrefixEnabled.checked,
          useDescendingOrder: orderDescending.checked,
          branchNamingStrategy,
          mergeIntoSingle: mergeExportEnabled.checked,
          mergeFilename: mergeFilenameInput.value.trim() || generatePageFilename(pageName) + '_export',
          format: selectedFormat,
          action: action,
          shallowExport: shallowExportEnabled.checked,
          epubOptions: { ...epubOptions },
          mdOptions: { ...mdOptions }
        });
      } else if (activeTab === 'pages') {
        // Pages mode export
        const selectedPageCheckboxes = pagesListContainer.querySelectorAll('.page-checkbox:checked');
        const selectedPages = Array.from(selectedPageCheckboxes).map(cb => ({
          uid: cb.dataset.uid,
          title: cb.dataset.title,
          shortName: cb.dataset.short
        }));

        if (selectedPages.length === 0) {
          alert('Por favor selecciona al menos una página para procesar.');
          return;
        }

        // Validate optional filter tag
        let validatedFilterTag = null;
        if (pageFilterEnabled && pageFilterEnabled.checked) {
          const tagValue = pageFilterTag.value.trim();
          if (!tagValue) {
            pageFilterTag.style.borderColor = '#DC143C';
            pageFilterTag.focus();
            return;
          }
          validatedFilterTag = cleanTagInput(tagValue);
        }

        cleanup();
        resolve({
          cancelled: false,
          mode: 'pages',
          selectedPages,
          filterTag: validatedFilterTag,
          format: selectedFormat,
          action: action,
          shallowExport: shallowExportEnabled.checked,
          epubOptions: { ...epubOptions },
          mdOptions: { ...mdOptions }
        });
      }
    };

    exportBtn.addEventListener('click', () => triggerAction('export'));
    copyBtn.addEventListener('click', () => triggerAction('copy'));

    // Copy UIDs button click
    copyUidsBtn.addEventListener('click', () => {
      if (activeTab === 'branches') {
        const selectedUids = getSelectedBranchUids();
        if (selectedUids.length === 0) {
          alert('Por favor selecciona al menos una rama para copiar sus UIDs.');
          return;
        }
        const uidText = selectedUids.map(uid => `((${uid}))`).join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(uidText)
            .then(() => showNotification(`✓ ${selectedUids.length} UIDs copiados al portapapeles`, '#28a745'))
            .catch(() => showNotification('✗ Error al copiar UIDs', '#DC143C'));
        } else {
          showNotification('✗ Portapapeles no disponible', '#DC143C');
        }
      } else if (activeTab === 'pages') {
        const selectedPageCheckboxes = pagesListContainer.querySelectorAll('.page-checkbox:checked');
        const selectedPages = Array.from(selectedPageCheckboxes).map(cb => ({
          uid: cb.dataset.uid,
          title: cb.dataset.title
        }));
        if (selectedPages.length === 0) {
          alert('Por favor selecciona al menos una página.');
          return;
        }
        const pageText = selectedPages.map(p => `[[${p.title}]]`).join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(pageText)
            .then(() => showNotification(`✓ ${selectedPages.length} referencias de páginas copiadas`, '#28a745'))
            .catch(() => showNotification('✗ Error al copiar', '#DC143C'));
        } else {
          showNotification('✗ Portapapeles no disponible', '#DC143C');
        }
      }
    });

    // Save Preset button click
    savePresetBtn.addEventListener('click', () => {
      const selectedUids = getSelectedBranchUids();
      if (selectedUids.length === 0) {
        alert('Por favor selecciona al menos un bloque para guardar.');
        return;
      }
      showPresetSaveDialog(selectedUids, pageName, pageUid);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve({ cancelled: true });
      }
    });

    // Close on Escape
    function handleKeydown(e) {
      if (e.key === 'Escape') {
        cleanup();
        resolve({ cancelled: true });
      }
    }
    document.addEventListener('keydown', handleKeydown);

    // Focus search input on open
    if (branchSearchInput) {
      branchSearchInput.focus();
    }

    // Auto-load preset from sessionStorage if navigation happened
    try {
      const autoLoad = JSON.parse(sessionStorage.getItem('roam-export-auto-load-preset') || 'null');
      if (autoLoad && autoLoad.pageUid === pageUid) {
        sessionStorage.removeItem('roam-export-auto-load-preset');
        const presetId = autoLoad.presetId;
        setTimeout(() => {
          const presets = getSavedPresets();
          const preset = presets.find(p => p.id === presetId);
          if (preset) {
            let markedCount = 0;
            preset.blockUids.forEach(uid => {
              const cb = treeContainer.querySelector(`.branch-checkbox[data-uid="${uid}"]`);
              if (cb) {
                cb.checked = true;
                markedCount++;
                
                const container = cb.closest('.tree-node');
                if (container) {
                  const descendantCheckboxes = container.querySelectorAll('.branch-checkbox');
                  descendantCheckboxes.forEach(childCb => {
                    childCb.checked = true;
                    childCb.indeterminate = false;
                  });

                  let parentContainer = container.parentElement.closest('.tree-node');
                  while (parentContainer) {
                    const parentCb = parentContainer.querySelector('.branch-checkbox');
                    if (parentCb) {
                      const allDescendants = Array.from(parentContainer.querySelectorAll('.branch-checkbox')).filter(c => c !== parentCb);
                      if (allDescendants.length > 0) {
                        const allChecked = allDescendants.every(c => c.checked);
                        const someChecked = allDescendants.some(c => c.checked || c.indeterminate);
                        if (allChecked) {
                          parentCb.checked = true;
                          parentCb.indeterminate = false;
                        } else if (someChecked) {
                          parentCb.checked = false;
                          parentCb.indeterminate = true;
                        } else {
                          parentCb.checked = false;
                          parentCb.indeterminate = false;
                        }
                      }
                    }
                    parentContainer = parentContainer.parentElement.closest('.tree-node');
                  }
                }
              }
            });
            updateBranchCount();
            updateSelectAllLabel();
            showNotification(`✓ Cargados ${markedCount} bloques del preset "${preset.name}"`, '#28a745');
          }
        }, 300);
      }
    } catch (e) {
      console.error("Error auto-loading preset:", e);
    }
  });
};

// Main unified export function
const unifiedExport = async () => {
  try {
    // Get current page
    const pageUid = getCurrentPageUid();
    if (!pageUid) {
      showNotification('❌ Abre una página primero', '#DC143C');
      return;
    }

    // Get page name
    const pageInfo = window.roamAlphaAPI.pull('[:node/title :block/string]', [':block/uid', pageUid]);
    const pageName = pageInfo?.[':node/title'] || pageInfo?.[':block/string'] || 'Unknown Page';

    // Show unified modal (passes pageUid so modal can fetch structure with dynamic depth)
    const result = await promptUnifiedExport(pageName, pageUid);

    if (result.cancelled) {
      return;
    }

    if (result.mode === 'branches') {
      // Export by branch selection
      const { selectedUids, filterTag, useOrderPrefix, useDescendingOrder, format, action, shallowExport, epubOptions, mdOptions, branchNamingStrategy = 'block', mergeIntoSingle, mergeFilename } = result;

      showNotification(`📄 Procesando ${selectedUids.length} ramas...`, '#137CBD');

      // Collect branch trees
      const branchTrees = [];
      const totalForPrefix = selectedUids.length;
      let orderIndex = 0;

      for (const uid of selectedUids) {
        try {
          let branchTree;
          
          if (shallowExport) {
            // SHALLOW EXPORT: Get only the root block text, no children
            const blockData = window.roamAlphaAPI.pull(
              '[:block/uid :block/string :block/heading]',
              [':block/uid', uid]
            );
            if (!blockData) continue;
            branchTree = {
              uid: blockData[':block/uid'],
              content: blockData[':block/string'] || '',
              heading: blockData[':block/heading'] || 0,
              children: [] // No children
            };
          } else {
            // Get the branch with all its descendants (NO ancestors)
            branchTree = getBlockWithDescendants(uid);
          }

          if (!branchTree) continue;

          // Add breadcrumbs
          const breadcrumbs = generateBreadcrumb(pageName, uid);
          if (breadcrumbs) {
            branchTree.breadcrumbMd = breadcrumbs.md;
            branchTree.breadcrumbXhtml = breadcrumbs.xhtml;
          }

          // If filter tag specified, prune sub-branches that don't contain the tag
          if (filterTag) {
            branchTree = filterTreeByTag(branchTree, filterTag);
            // Skip if no matching children remain (and root doesn't have the tag either)
            if (!branchTree || (!branchTree.children || branchTree.children.length === 0) && !contentContainsTag(branchTree.content, filterTag)) {
              continue;
            }
          }

          branchTrees.push({
            tree: branchTree,
            orderIndex: orderIndex
          });

          orderIndex++;
        } catch (err) {
          console.error(`Error processing branch ${uid}:`, err);
        }
      }

      if (branchTrees.length === 0) {
        const filterMsg = filterTag ? ` con tag #${filterTag}` : '';
        showNotification(`❌ No se encontró contenido${filterMsg}`, '#DC143C');
        return;
      }

      // Export based on format
      if (format === 'epub') {
        // EPUB: Combine all branches into a single EPUB
        showNotification(`📚 Generando EPUB con ${branchTrees.length} ramas...`, '#137CBD');

        // Build combined tree for EPUB
        const combinedTree = branchTrees.map(b => b.tree);
        const title = `${pageName}${filterTag ? ` - ${filterTag}` : ''}`;

        const success = await downloadAsEpub(combinedTree, title, epubOptions);
        if (success) {
          showNotification(`✓ EPUB exportado: ${branchTrees.length} ramas`, '#28a745');
        } else {
          showNotification('❌ Error generando EPUB', '#DC143C');
        }
      } else if (mergeIntoSingle) {
        // MERGE MODE: Combine all branches into a single Markdown file
        const allSections = [];

        for (const { tree: branchTree } of branchTrees) {
          const markdown = treeToMarkdown([branchTree], 0, mdOptions);

          if (action === 'copy') {
            allSections.push(markdown);
            continue;
          }

          const rootContent = branchTree.content || 'untitled';
          const ancestors = getOrderedBlockAncestors(branchTree.uid);

          let ancestorsContext = "";
          if (ancestors.length > 0) {
            ancestorsContext = "\n>\n> **Jerarquía original:**\n";
            let indent = "> ";
            for (const anc of ancestors) {
              ancestorsContext += `${indent}- ${anc.content}\n`;
              indent += "  ";
            }
          }
          const breadcrumbText = ancestorsContext || branchTree.breadcrumbMd || '';

          // Each branch gets an H2 heading (H1 is reserved for the global title)
          const section = `## ${rootContent}${breadcrumbText}\n\n${markdown}`;
          allSections.push(section);
        }

        if (action === 'copy') {
           // Copy to clipboard instead of downloading, cleanly
           const mergedContent = allSections.join('\n');
           if (navigator.clipboard && navigator.clipboard.writeText) {
             navigator.clipboard.writeText(mergedContent)
               .then(() => showNotification(`✓ Copiado al portapapeles (${branchTrees.length} ramas combinadas)`, '#137CBD'))
               .catch(() => showNotification('✗ Error al copiar', '#DC143C'));
           } else {
             showNotification('✗ Portapapeles no disponible', '#DC143C');
           }
        } else {
          // Regular file export
          const globalHeader = `# ${pageName}\n> Generated: ${new Date().toLocaleString()}\n> Ramas procesadas: ${branchTrees.length}${filterTag ? `\n> Filter: #${filterTag}` : ''}\n\n---\n\n`;
          const mergedContent = globalHeader + allSections.join('\n---\n\n');
          const filename = (mergeFilename || generatePageFilename(pageName) + '_export') + '.md';
          downloadFile(mergedContent, filename);
          showNotification(`✓ Exportado archivo combinado (${branchTrees.length} ramas)`, '#28a745');
        }

      } else {
        // Markdown: One file per branch (existing behavior)
        const files = [];

        for (const { tree: branchTree, orderIndex: idx } of branchTrees) {
          const rootContent = branchTree.content || 'untitled';
          const prefixNumber = useDescendingOrder ? (totalForPrefix - idx) : (idx + 1);
          const prefix = useOrderPrefix ? String(prefixNumber).padStart(2, '0') + '_' : '';

          const safePage = generatePageFilename(pageName);
          const blockName = generateRootFilename(rootContent);
          const dateStr = extractDate(rootContent, pageName);

          let baseName = '';
          if (branchNamingStrategy === 'block') {
            baseName = `${dateStr}_${blockName}`;
          } else if (branchNamingStrategy === 'page_block') {
            baseName = `${safePage}_${dateStr}_${blockName}`;
          } else if (branchNamingStrategy === 'page') {
            baseName = `${safePage}_${dateStr}`;
          }

          let filename = prefix + baseName + '.md';

          // Collision prevention: If filename already exists, append _2, _3...
          let counter = 2;
          while (files.some(f => f.filename === filename)) {
            filename = prefix + baseName + `_${counter}.md`;
            counter++;
          }

          const ancestors = getOrderedBlockAncestors(branchTree.uid);
          const markdown = treeToMarkdown([branchTree], 0, mdOptions);

          let contentToSave;
          if (action === 'copy') {
            contentToSave = markdown;
          } else {
            let ancestorsContext = "";
            if (ancestors.length > 0) {
              ancestorsContext = "\n>\n> **Jerarquía original:**\n";
              let indent = "> ";
              for (const anc of ancestors) {
                ancestorsContext += `${indent}- ${anc.content}\n`;
                indent += "  ";
              }
            }
            const breadcrumbText = ancestorsContext || branchTree.breadcrumbMd || '';
            const header = `# ${rootContent}\n> Generated: ${new Date().toLocaleString()}${filterTag ? `\n> Filter: #${filterTag}` : ''}${breadcrumbText}\n\n---\n\n`;
            contentToSave = header + markdown;
          }

          files.push({
            filename,
            content: contentToSave
          });
        }

        // Process files (download or copy)
        if (action === 'copy') {
          // If copying multiple unmerged branches, concatenate them cleanly
          const combinedForClipboard = files.map(f => f.content).join('\n');
          if (navigator.clipboard && navigator.clipboard.writeText) {
             navigator.clipboard.writeText(combinedForClipboard)
               .then(() => showNotification(`✓ Copiados ${files.length} fragmentos al portapapeles`, '#137CBD'))
               .catch(() => showNotification('✗ Error al copiar', '#DC143C'));
          } else {
             showNotification('✗ Portapapeles no disponible', '#DC143C');
          }
        } else {
          // Download based on file count
          if (files.length <= 5) {
            // Individual downloads
            for (const file of files) {
              downloadFile(file.content, file.filename);
            }
            showNotification(`✓ Exportados ${files.length} archivos`, '#28a745');
          } else {
            // ZIP download
            try {
              const JSZip = await loadJSZip();
              const zip = new JSZip();

              for (const file of files) {
                zip.file(sanitizeFilename(file.filename), file.content);
              }

              const dateStr = generateDateString(new Date());
              const safePageName = generatePageFilename(pageName);
              const zipFilename = `export_${safePageName}_${dateStr}.zip`;

              const blob = await zip.generateAsync({ type: 'blob' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = zipFilename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);

              showNotification(`✓ Exportado ZIP con ${files.length} archivos`, '#28a745');
            } catch (err) {
              console.error('Error creating ZIP:', err);
              showNotification('❌ Error creando ZIP', '#DC143C');
            }
          }
        }
      }

    } else if (result.mode === 'pages') {
      // Export by page selection
      const { selectedPages, filterTag, format, action, shallowExport, epubOptions, mdOptions } = result;

      showNotification(`📄 Procesando ${selectedPages.length} página${selectedPages.length !== 1 ? 's' : ''}...`, '#137CBD');

      const files = [];

      for (const page of selectedPages) {
        try {
          const safeName = generatePageFilename(page.title);
          let tree;

          if (filterTag) {
            // Use findBlocksByTag with this page's UID
            const blocks = findBlocksByTag(filterTag, page.uid);
            if (!blocks || blocks.length === 0) continue;
            tree = buildExportTree(blocks);
          } else {
            // Get all content from the page
            const roots = getRootBlocks(page.uid);
            if (!roots || roots.length === 0) continue;
            
            if (shallowExport) {
              // SHALLOW EXPORT: Only the root level blocks of the page
              tree = roots.map(r => {
                const uid = r[':block/uid'] || r.uid;
                const blockData = window.roamAlphaAPI.pull(
                  '[:block/uid :block/string :block/heading]',
                  [':block/uid', uid]
                );
                if (!blockData) return null;
                return {
                  uid: blockData[':block/uid'],
                  content: blockData[':block/string'] || '',
                  heading: blockData[':block/heading'] || 0,
                  children: [] // No children
                };
              }).filter(Boolean);
            } else {
              // Full descendant tree
              tree = roots.map(r => {
                const uid = r[':block/uid'] || r.uid;
                return getBlockWithDescendants(uid);
              }).filter(Boolean);
            }
          }

          if (!tree || tree.length === 0) continue;

          if (format === 'epub') {
            const blob = await generateEpubBlob(tree, page.shortName, epubOptions);
            files.push({ filename: `${safeName}.epub`, blob, isBlob: true });
          } else {
            const markdown = treeToMarkdown(tree, 0, mdOptions);
            let contentToSave;
            if (action === 'copy') {
              contentToSave = markdown;
            } else {
              const header = `# ${page.shortName}\n> Generated: ${new Date().toLocaleString()}${filterTag ? `\n> Filter: #${filterTag}` : ''}\n\n---\n\n`;
              contentToSave = header + markdown;
            }
            files.push({ filename: `${safeName}.md`, content: contentToSave, isBlob: false });
          }
        } catch (err) {
          console.error(`Error processing page ${page.title}:`, err);
        }
      }

      if (files.length === 0) {
        const filterMsg = filterTag ? ` con tag #${filterTag}` : '';
        showNotification(`❌ No se encontró contenido${filterMsg}`, '#DC143C');
        return;
      }

      // Process files based on action
      if (action === 'copy') {
        if (format === 'epub') {
           showNotification('❌ No se puede copiar EPUB al portapapeles', '#DC143C');
        } else {
           const combinedForClipboard = files.map(f => f.content).join('\n\n');
           if (navigator.clipboard && navigator.clipboard.writeText) {
             navigator.clipboard.writeText(combinedForClipboard)
               .then(() => showNotification(`✓ Copiado contenido de ${files.length} páginas al portapapeles`, '#137CBD'))
               .catch(() => showNotification('✗ Error al copiar', '#DC143C'));
           } else {
             showNotification('✗ Portapapeles no disponible', '#DC143C');
           }
        }
      } else {
        // Download based on file count
        if (files.length <= 5) {
          // Individual downloads
          for (const f of files) {
            if (f.isBlob) {
              downloadBlob(f.blob, f.filename);
            } else {
              downloadFile(f.content, f.filename);
            }
          }
          showNotification(`✓ Exportado${files.length !== 1 ? 's' : ''} ${files.length} archivo${files.length !== 1 ? 's' : ''}`, '#28a745');
        } else {
          // ZIP download
          try {
            const JSZip = await loadJSZip();
            const zip = new JSZip();

            for (const f of files) {
              zip.file(sanitizeFilename(f.filename), f.isBlob ? f.blob : f.content);
            }

            const dateStr = generateDateString(new Date());
            const safePageName = generatePageFilename(pageName);
            const zipFilename = `export_${safePageName}_${dateStr}.zip`;

            const blob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(blob, zipFilename);

            showNotification(`✓ Exportado ZIP con ${files.length} archivos`, '#28a745');
          } catch (err) {
            console.error('Error creating ZIP:', err);
            showNotification('❌ Error creando ZIP', '#DC143C');
          }
        }
      }
    }

  } catch (err) {
    console.error('Error in unifiedExport:', err);
    showNotification(`❌ Error: ${err.message}`, '#DC143C');
  }
};

const promptForTag = () => {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">Export Filtered Content</h3>
      <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #666;">
        Enter tag to export (without #):
      </label>
      <input type="text" id="roam-filter-tag-input" 
        style="width: 100%; padding: 8px 12px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"
        placeholder="e.g., filtrarEsto"
      />
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
        <button id="roam-filter-cancel" 
          style="padding: 8px 16px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; background: #f5f5f5; cursor: pointer;">
          Cancel
        </button>
        <button id="roam-filter-export" 
          style="padding: 8px 16px; font-size: 14px; border: none; border-radius: 4px; background: #137CBD; color: white; cursor: pointer;">
          Export
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = document.getElementById('roam-filter-tag-input');
    const cancelBtn = document.getElementById('roam-filter-cancel');
    const exportBtn = document.getElementById('roam-filter-export');

    input.focus();

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    const submit = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    exportBtn.addEventListener('click', submit);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submit();
      } else if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });
  });
};

const exportFilteredContent = async () => {
  try {
    // Step 1: Get tag from user
    const rawInput = await promptForTag();

    if (!rawInput) {
      return; // User cancelled
    }

    // Clean input to support #tag, [[tag]], #[[tag]] formats
    const tagName = cleanTagInput(rawInput);
    if (!tagName) {
      showNotification('❌ Invalid tag name', '#DC143C');
      return;
    }

    showNotification(`🔍 Searching for #${tagName}...`, '#137CBD');

    // Step 2: Find blocks with the tag
    if (DEBUG) console.log("=== EXPORT DEBUG: Step 2 - Finding blocks ===");
    const blocks = findBlocksByTag(tagName);
    if (DEBUG) console.log("Blocks found:", blocks);

    if (blocks.length === 0) {
      showNotification(`❌ No blocks found with #${tagName}`, '#DC143C');
      return;
    }

    // Step 3: Build export tree
    if (DEBUG) console.log("=== EXPORT DEBUG: Step 3 - Building tree ===");
    const tree = buildExportTree(blocks);
    if (DEBUG) console.log("Tree built:", tree);

    if (tree.length === 0) {
      showNotification(`❌ Could not build export tree`, '#DC143C');
      return;
    }

    // Step 4: Generate Markdown
    if (DEBUG) console.log("=== EXPORT DEBUG: Step 4 - Generating Markdown ===");
    const header = generateHeader(tagName, blocks.length);
    const markdown = treeToMarkdown(tree);
    if (DEBUG) console.log("Markdown generated:", markdown);
    const content = header + markdown;

    // Step 5: Download file
    const filename = generateFilename(tagName);
    const success = downloadFile(content, filename);

    if (success) {
      showNotification(`✓ Exported ${blocks.length} blocks to ${filename}`, '#28a745');
    } else {
      showNotification(`❌ Failed to download file`, '#DC143C');
    }

  } catch (err) {
    console.error("Error in exportFilteredContent:", err);
    showNotification(`❌ Error: ${err.message}`, '#DC143C');
  }
};

// Copy filtered content to clipboard (quick copy for small amounts)
const copyFilteredContent = async () => {
  try {
    // Step 1: Get tag from user
    const rawInput = await promptForTag();

    if (!rawInput) {
      return; // User cancelled
    }

    // Clean input to support #tag, [[tag]], #[[tag]] formats
    const tagName = cleanTagInput(rawInput);
    if (!tagName) {
      showNotification('❌ Invalid tag name', '#DC143C');
      return;
    }

    showNotification(`🔍 Searching for #${tagName}...`, '#137CBD');

    // Step 2: Find blocks with the tag
    const blocks = findBlocksByTag(tagName);

    if (blocks.length === 0) {
      showNotification(`❌ No blocks found with #${tagName}`, '#DC143C');
      return;
    }

    // Step 3: Build export tree
    const tree = buildExportTree(blocks);

    if (tree.length === 0) {
      showNotification(`❌ Could not build export tree`, '#DC143C');
      return;
    }

    // Step 4: Generate Markdown (no header for clipboard)
    const markdown = treeToMarkdown(tree);

    // Step 5: Copy to clipboard
    if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
      // Fallback to writeText
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(markdown);
        showNotification(`✓ Copied ${blocks.length} blocks to clipboard`, '#28a745');
        return;
      }
      showNotification('✗ Error: Clipboard not available', '#DC143C');
      return;
    }

    // Write both text and HTML to clipboard
    const textBlob = new Blob([markdown], { type: 'text/plain' });
    const htmlBlob = new Blob([treeToHTML(tree)], { type: 'text/html' });

    const clipboardItem = new ClipboardItem({
      'text/plain': textBlob,
      'text/html': htmlBlob
    });

    await navigator.clipboard.write([clipboardItem]);
    showNotification(`✓ Copied ${blocks.length} blocks (Text + HTML)`, '#28a745');

  } catch (err) {
    console.error("Error in copyFilteredContent:", err);
    showNotification(`❌ Error: ${err.message}`, '#DC143C');
  }
};

// ============================================
// EXPORT BY ROOT BLOCKS
// ============================================

// Prompt for root export options (with toggle, preview, and favorite tags)
const promptForRootExport = (pageName, rootCount, rootBlocks, pageUid) => {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Build favorite tags HTML
    const tagsHtml = FAVORITE_TAGS.length > 0 ? `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; color: #888; margin-bottom: 6px;">Favorite tags (click to use):</div>
        <div id="roam-root-tags" style="display: flex; flex-wrap: wrap; gap: 4px;">
          ${FAVORITE_TAGS.map(tag => `
            <span class="roam-tag-chip" data-tag="${tag}" 
              style="padding: 2px 8px; font-size: 12px; background: #e3f2fd; color: #1976d2; 
                     border-radius: 12px; cursor: pointer; transition: background 0.2s;">
              #${tag}
            </span>
          `).join('')}
        </div>
      </div>
    ` : '';

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 380px;
      max-width: 450px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">Export by Root Blocks</h3>
      <div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px;">
        <div style="font-size: 13px; color: #666;">Page: <strong>${pageName}</strong></div>
        <div style="font-size: 13px; color: #666;">Root blocks found: <strong>${rootCount}</strong></div>
      </div>
      
      ${tagsHtml}
      
      <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #666;">
        Filter by tag (optional):
      </label>
      <input type="text" id="roam-root-filter-input" 
        style="width: 100%; padding: 8px 12px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"
        placeholder="e.g., textoÍntegro (leave empty for all)"
      />
      
      <div id="roam-root-preview" style="margin-top: 8px; font-size: 13px; color: #666; min-height: 20px;">
        → Will export: <strong>${rootCount}</strong> files
      </div>
      
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #555; cursor: pointer;">
          <input type="checkbox" id="roam-root-invert" checked style="margin: 0;">
          Invert order (01 = bottom block in Roam)
        </label>
      </div>
      
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
        <button id="roam-root-cancel" 
          style="padding: 8px 16px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; background: #f5f5f5; cursor: pointer;">
          Cancel
        </button>
        <button id="roam-root-export" 
          style="padding: 8px 16px; font-size: 14px; border: none; border-radius: 4px; background: #28a745; color: white; cursor: pointer;">
          Export ${rootCount} files
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = document.getElementById('roam-root-filter-input');
    const cancelBtn = document.getElementById('roam-root-cancel');
    const exportBtn = document.getElementById('roam-root-export');
    const invertCheckbox = document.getElementById('roam-root-invert');
    const previewDiv = document.getElementById('roam-root-preview');
    const tagsContainer = document.getElementById('roam-root-tags');

    input.focus();

    // Debounce timer for preview updates
    let debounceTimer = null;

    const updatePreview = () => {
      const filterValue = input.value.trim();
      const cleanedTag = filterValue ? cleanTagInput(filterValue) : null;
      const matchCount = countMatchingRoots(rootBlocks, cleanedTag);

      previewDiv.innerHTML = cleanedTag
        ? `→ Will export: <strong>${matchCount}</strong> of ${rootCount} files`
        : `→ Will export: <strong>${rootCount}</strong> files`;

      exportBtn.textContent = `Export ${matchCount} files`;
    };

    // Listen for input changes with debounce
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePreview, 300);
    });

    // Tag chip click handlers
    if (tagsContainer) {
      tagsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.roam-tag-chip');
        if (chip) {
          input.value = chip.dataset.tag;
          updatePreview();
        }
      });
    }

    const cleanup = () => {
      clearTimeout(debounceTimer);
      document.body.removeChild(overlay);
    };

    const submit = () => {
      const filterValue = input.value.trim();
      const invertOrder = invertCheckbox.checked;
      cleanup();
      resolve({ cancelled: false, filter: filterValue || null, invertOrder });
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve({ cancelled: true, filter: null, invertOrder: true });
    });

    exportBtn.addEventListener('click', submit);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submit();
      } else if (e.key === 'Escape') {
        cleanup();
        resolve({ cancelled: true, filter: null, invertOrder: true });
      }
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve({ cancelled: true, filter: null, invertOrder: true });
      }
    });
  });
};

// Main export by root blocks function
const exportByRootBlocks = async () => {
  try {
    // Step 1: Get current page
    const pageUid = getCurrentPageUid();
    if (!pageUid) {
      showNotification('❌ Could not detect current page', '#DC143C');
      return;
    }

    // Get page name
    const pageInfo = window.roamAlphaAPI.pull('[:node/title :block/string]', [':block/uid', pageUid]);
    const pageName = pageInfo?.[':node/title'] || pageInfo?.[':block/string'] || 'Unknown Page';

    // Step 2: Get root blocks
    const rootBlocks = getRootBlocks(pageUid);
    if (rootBlocks.length === 0) {
      showNotification('❌ No root blocks found on this page', '#DC143C');
      return;
    }

    // Step 3: Show prompt (pass rootBlocks and pageUid for preview and tags features)
    const { cancelled, filter, invertOrder } = await promptForRootExport(pageName, rootBlocks.length, rootBlocks, pageUid);
    if (cancelled) {
      return;
    }

    const tagFilter = filter ? cleanTagInput(filter) : null;
    if (DEBUG) console.log(`Export by Root Blocks - Filter: ${tagFilter || 'none'}, Invert: ${invertOrder}`);

    showNotification(`📄 Processing ${rootBlocks.length} root blocks...`, '#137CBD');

    // Step 4: Process each root block and collect files
    const filesToExport = [];
    let skippedCount = 0;

    let orderIndex = 1; // Track order for filename prefix
    for (let i = 0; i < rootBlocks.length; i++) {
      const rootBlock = rootBlocks[i];
      const rootUid = rootBlock[':block/uid'] || rootBlock.uid;
      const rootContent = rootBlock[':block/string'] || rootBlock.string || '';

      if (!rootUid || !rootContent) {
        skippedCount++;
        continue;
      }

      // Get children (filtered if tag provided)
      const children = getFilteredChildren(rootUid, tagFilter);

      // Skip if filter is active and no matching children
      if (tagFilter && children.length === 0) {
        skippedCount++;
        continue;
      }

      // Generate markdown and filename with order prefix
      const markdown = rootBlockToMarkdown(rootContent, children);
      const baseFilename = generateRootFilename(rootContent);
      const safePageName = generatePageFilename(pageName);
      const dateStr = extractDate(rootContent, pageName);
      // Pad order number - invertOrder: bottom block = 01, otherwise top block = 01
      const orderNum = invertOrder ? (rootBlocks.length - orderIndex + 1) : orderIndex;
      const orderPrefix = String(orderNum).padStart(2, '0');
      const filename = `${orderPrefix}_${safePageName}_${dateStr}_${baseFilename}.md`;
      orderIndex++;

      filesToExport.push({ filename, content: markdown });
    }

    if (filesToExport.length === 0) {
      showNotification(`❌ No blocks matched the filter`, '#DC143C');
      return;
    }

    // Step 5: Export - ZIP if >5 files, individual downloads otherwise
    if (filesToExport.length > 5) {
      // Use ZIP export
      showNotification(`📦 Creating ZIP with ${filesToExport.length} files...`, '#137CBD');

      try {
        const JSZip = await loadJSZip();
        const zip = new JSZip();

        // Add all files to the ZIP
        for (const file of filesToExport) {
          zip.file(sanitizeFilename(file.filename), file.content);
        }

        // Generate ZIP blob
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // Generate ZIP filename
        const dateStr = generateDateString(new Date());
        const safePageName = generatePageFilename(pageName);
        const zipFilename = `export_${safePageName}_${dateStr}.zip`;

        // Download ZIP
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = zipFilename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);

        const filterMsg = tagFilter ? ` (filtered by #${tagFilter})` : '';
        showNotification(`✓ Exported ${filesToExport.length} files as ZIP${filterMsg}`, '#28a745');

      } catch (zipErr) {
        console.error('ZIP creation failed:', zipErr);
        showNotification(`❌ ZIP creation failed: ${zipErr.message}`, '#DC143C');
      }

    } else {
      // Individual file downloads (original behavior)
      let exportedCount = 0;

      for (let i = 0; i < filesToExport.length; i++) {
        const { filename, content } = filesToExport[i];
        const success = downloadFile(content, filename);
        if (success) {
          exportedCount++;
        }

        // Small delay between downloads to avoid browser blocking
        if (i < filesToExport.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      const filterMsg = tagFilter ? ` (filtered by #${tagFilter})` : '';
      showNotification(`✓ Exported ${exportedCount} files${filterMsg}`, '#28a745');
    }

  } catch (err) {
    console.error("Error in exportByRootBlocks:", err);
    showNotification(`❌ Error: ${err.message}`, '#DC143C');
  }
};

// ============================================
// EXPORT BY BRANCH SELECTION
// ============================================

// Get page structure limited to maxDepth levels for the branch selector
const getPageStructure = (pageUid, maxDepth = 3) => {
  if (!isRoamAPIAvailable() || !pageUid) {
    return [];
  }

  try {
    const pageData = window.roamAlphaAPI.pull(
      '[:block/uid {:block/children [:block/uid :block/string :block/order {:block/children [:block/uid]}]}]',
      [':block/uid', pageUid]
    );

    if (!pageData || !pageData[':block/children']) {
      return [];
    }

    const buildStructure = (blocks, currentLevel) => {
      if (!blocks || blocks.length === 0 || currentLevel > maxDepth) {
        return [];
      }

      return blocks
        .sort((a, b) => (a[':block/order'] || 0) - (b[':block/order'] || 0))
        .map(block => {
          const uid = block[':block/uid'];
          if (!uid) return null;

          // Fetch full block data
          const fullBlock = window.roamAlphaAPI.pull(
            '[:block/uid :block/string :block/order {:block/children [:block/uid :block/order]}]',
            [':block/uid', uid]
          );

          if (!fullBlock) return null;

          const content = fullBlock[':block/string'] || '';
          const children = fullBlock[':block/children'] || [];

          // Check if there are children beyond maxDepth
          const hasDeepChildren = currentLevel === maxDepth && children.length > 0;

          // Count total descendants for display
          let deepChildrenCount = 0;
          if (hasDeepChildren) {
            const countDescendants = (blockUid) => {
              const b = window.roamAlphaAPI.pull(
                '[{:block/children [:block/uid]}]',
                [':block/uid', blockUid]
              );
              const c = b?.[':block/children'] || [];
              return c.length + c.reduce((sum, child) => sum + countDescendants(child[':block/uid']), 0);
            };
            deepChildrenCount = children.length + children.reduce((sum, c) => sum + countDescendants(c[':block/uid']), 0);
          }

          return {
            uid,
            content: content.length > 60 ? content.substring(0, 57) + '...' : content,
            fullContent: content,
            level: currentLevel,
            hasDeepChildren,
            deepChildrenCount,
            children: currentLevel < maxDepth ? buildStructure(children, currentLevel + 1) : []
          };
        })
        .filter(Boolean);
    };

    return buildStructure(pageData[':block/children'], 1);
  } catch (err) {
    console.error('Error in getPageStructure:', err);
    return [];
  }
};

// Fetch blocks with their parents for export (format compatible with buildExportTree)
const fetchBlocksForExport = (selectedUids, filterTag = null) => {
  if (!selectedUids || selectedUids.length === 0) {
    return [];
  }

  const blocks = [];

  for (const uid of selectedUids) {
    try {
      // Get block with parents
      const result = window.roamAlphaAPI.data.q(`
        [:find (pull ?block [:block/uid :block/string :block/order
                             {:block/parents [:block/uid :block/string :block/order]}])
         :where
         [?block :block/uid "${escapeDatalogString(uid)}"]]
      `);

      if (result && result.length > 0 && result[0][0]) {
        const block = result[0][0];

        // If filter tag is specified, check if this block or its descendants contain it
        if (filterTag) {
          const hasTag = window.roamAlphaAPI.data.q(`
            [:find ?match .
             :where
             [?tag :node/title "${escapeDatalogString(filterTag)}"]
             [?root :block/uid "${escapeDatalogString(uid)}"]
             (or
               [?root :block/refs ?tag]
               (and
                 [?descendant :block/refs ?tag]
                 [?descendant :block/parents ?root]))
             [(identity ?root) ?match]]
          `);

          if (!hasTag) continue; // Skip blocks without the tag
        }

        blocks.push(block);
      }
    } catch (err) {
      console.error(`Error fetching block ${uid}:`, err);
    }
  }

  return blocks;
};

// Prompt for branch selection with visual tree
const promptForBranchSelection = (pageName, structure) => {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 500px;
      max-width: 700px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
    `;

    // Render tree structure with checkboxes
    const renderTree = (nodes, indentLevel = 0) => {
      return nodes.map(node => {
        const indent = indentLevel * 20;
        const deepInfo = node.hasDeepChildren ? ` <span style="color: #888; font-size: 11px;">(+${node.deepChildrenCount} sub-bloques)</span>` : '';
        return `
          <div class="branch-node-container" style="padding: 4px 0; padding-left: ${indent}px;">
            <label style="display: flex; align-items: flex-start; cursor: pointer; gap: 8px;">
              <input type="checkbox" class="branch-checkbox" data-uid="${node.uid}" style="margin-top: 3px; cursor: pointer;">
              <span style="font-size: 13px; line-height: 1.4;" title="${node.fullContent.replace(/"/g, '&quot;')}">${node.content}${deepInfo}</span>
            </label>
            ${node.children && node.children.length > 0 ? renderTree(node.children, indentLevel + 1) : ''}
          </div>
        `;
      }).join('');
    };

    modal.innerHTML = `
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #333;">
        📂 Seleccionar ramas para exportar
      </h3>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #666;">
        Página: <strong>${pageName}</strong>
      </p>
      
      <div id="branch-tree-container" style="
        flex: 1;
        overflow-y: auto;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 16px;
        max-height: 400px;
        background: #fafafa;
      ">
        ${structure.length > 0 ? renderTree(structure) : '<p style="color: #888;">No hay bloques en esta página</p>'}
      </div>
      
      <div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
          <input type="checkbox" id="branch-filter-enabled">
          <span>Filtrar por tag (opcional):</span>
        </label>
        <input type="text" id="branch-filter-tag" 
          style="width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-top: 8px; opacity: 0.5;"
          placeholder="Ej: #resumen, [[concepto]], etc."
          disabled
        />
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span id="branch-selection-count" style="font-size: 13px; color: #666;">0 ramas seleccionadas</span>
        <div style="display: flex; gap: 8px;">
          <button id="branch-cancel" 
            style="padding: 8px 16px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; background: #f5f5f5; cursor: pointer;">
            Cancelar
          </button>
          <button id="branch-export" 
            style="padding: 8px 16px; font-size: 14px; border: none; border-radius: 4px; background: #137CBD; color: white; cursor: pointer;">
            Exportar
          </button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Get elements
    const cancelBtn = document.getElementById('branch-cancel');
    const exportBtn = document.getElementById('branch-export');
    const filterEnabled = document.getElementById('branch-filter-enabled');
    const filterTag = document.getElementById('branch-filter-tag');
    const selectionCount = document.getElementById('branch-selection-count');
    const treeContainer = document.getElementById('branch-tree-container');

    // Update selection count
    const updateCount = () => {
      const checked = treeContainer.querySelectorAll('.branch-checkbox:checked');
      const count = checked.length;
      selectionCount.textContent = `${count} rama${count !== 1 ? 's' : ''} seleccionada${count !== 1 ? 's' : ''}`;
    };

    // Add event listeners to checkboxes
    treeContainer.querySelectorAll('.branch-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const container = e.target.closest('.branch-node-container');
        
        if (container) {
          // 1. Cascada hacia abajo: Seleccionar/deseleccionar todos los hijos
          const descendantCheckboxes = container.querySelectorAll('.branch-checkbox');
          descendantCheckboxes.forEach(childCb => {
            childCb.checked = isChecked;
            childCb.indeterminate = false;
          });
          
          // 2. Cascada hacia arriba
          let parentContainer = container.parentElement.closest('.branch-node-container');
          while (parentContainer) {
            const parentCb = parentContainer.querySelector('.branch-checkbox');
            if (parentCb) {
              const allDescendants = Array.from(parentContainer.querySelectorAll('.branch-checkbox')).filter(c => c !== parentCb);
              if (allDescendants.length > 0) {
                const allChecked = allDescendants.every(c => c.checked);
                const someChecked = allDescendants.some(c => c.checked || c.indeterminate);
                if (allChecked) {
                  parentCb.checked = true;
                  parentCb.indeterminate = false;
                } else if (someChecked) {
                  parentCb.checked = false;
                  parentCb.indeterminate = true;
                } else {
                  parentCb.checked = false;
                  parentCb.indeterminate = false;
                }
              }
            }
            parentContainer = parentContainer.parentElement.closest('.branch-node-container');
          }
        }
        
        updateCount();
      });
    });

    // Filter toggle
    filterEnabled.addEventListener('change', () => {
      filterTag.disabled = !filterEnabled.checked;
      filterTag.style.opacity = filterEnabled.checked ? '1' : '0.5';
      if (filterEnabled.checked) {
        filterTag.focus();
      }
    });

    function cleanup() {
      document.body.removeChild(overlay);
      document.removeEventListener('keydown', handleEscape);
    }

    const getSelectedUids = () => {
      const checked = treeContainer.querySelectorAll('.branch-checkbox:checked');
      return Array.from(checked).map(cb => cb.dataset.uid);
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve({ cancelled: true });
    });

    exportBtn.addEventListener('click', () => {
      const selectedUids = getSelectedUids();
      if (selectedUids.length === 0) {
        alert('Por favor selecciona al menos una rama para exportar.');
        return;
      }
      cleanup();
      resolve({
        cancelled: false,
        selectedUids,
        filterTag: filterEnabled.checked ? cleanTagInput(filterTag.value) : null
      });
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve({ cancelled: true });
      }
    });

    // Close on Escape
    function handleEscape(e) {
      if (e.key === 'Escape') {
        cleanup();
        resolve({ cancelled: true });
      }
    }
    document.addEventListener('keydown', handleEscape);
  });
};

// Main export by branch selection function
const exportByBranchSelection = async () => {
  try {
    // Step 1: Get current page
    const pageUid = getCurrentPageUid();
    if (!pageUid) {
      showNotification('❌ Could not detect current page', '#DC143C');
      return;
    }

    // Get page name
    const pageInfo = window.roamAlphaAPI.pull('[:node/title :block/string]', [':block/uid', pageUid]);
    const pageName = pageInfo?.[':node/title'] || pageInfo?.[':block/string'] || 'Unknown Page';

    // Step 2: Get page structure (limited to 3 levels)
    showNotification('📊 Loading page structure...', '#137CBD');
    const structure = getPageStructure(pageUid, 3);

    if (structure.length === 0) {
      showNotification('❌ No blocks found on this page', '#DC143C');
      return;
    }

    // Step 3: Show branch selection modal
    const { cancelled, selectedUids, filterTag } = await promptForBranchSelection(pageName, structure);

    if (cancelled) {
      return;
    }

    showNotification(`📄 Processing ${selectedUids.length} selected branches...`, '#137CBD');

    // Step 4: Fetch blocks with parents (optionally filtered)
    const blocks = fetchBlocksForExport(selectedUids, filterTag);

    if (blocks.length === 0) {
      const filterMsg = filterTag ? ` with tag #${filterTag}` : '';
      showNotification(`❌ No content found${filterMsg}`, '#DC143C');
      return;
    }

    // Step 5: Build export tree and convert to markdown
    const exportTree = buildExportTree(blocks);

    if (!exportTree || exportTree.length === 0) {
      showNotification('❌ Could not build export tree', '#DC143C');
      return;
    }

    const markdown = treeToMarkdown(exportTree);

    // Step 6: Generate filename and download
    const dateStr = generateDateString(new Date());
    const safePageName = generatePageFilename(pageName);
    const filterSuffix = filterTag ? `_${sanitizeToCamelCase(filterTag, true)}` : '';
    const filename = `branches_${safePageName}${filterSuffix}_${dateStr}.md`;

    const header = `# Export: ${pageName}\n> Generated: ${new Date().toLocaleString()}\n> Branches: ${selectedUids.length}${filterTag ? `\n> Filter: #${filterTag}` : ''}\n\n---\n\n`;

    const success = downloadFile(header + markdown, filename);

    if (success) {
      const filterMsg = filterTag ? ` (filtered by #${filterTag})` : '';
      showNotification(`✓ Exported ${selectedUids.length} branches${filterMsg}`, '#28a745');
    }

  } catch (err) {
    console.error('Error in exportByBranchSelection:', err);
    showNotification(`❌ Error: ${err.message}`, '#DC143C');
  }
};

// Convert tree to HTML for rich pasting
const treeToHTML = (trees, indentLevel = 0) => {
  if (!trees || trees.length === 0) {
    return "";
  }

  let html = "<ul>";
  for (const node of trees) {
    html += `<li>${node.content}`;
    if (node.children && node.children.length > 0) {
      html += treeToHTML(node.children, indentLevel + 1);
    }
    html += "</li>";
  }
  html += "</ul>";
  return html;
};

// ============================================
// VISUAL SELECTION COPY (Alt+Shift+C)
// ============================================

// Performance optimization: Cache for descendants during copy operation
let descendantsCache = null;
let blockInfoCache = null;

// Helper to get block info with caching
const getBlockInfoCached = (blockUid, query) => {
  if (!blockInfoCache) return null;

  const cacheKey = `${blockUid}:${query}`;
  if (blockInfoCache.has(cacheKey)) {
    return blockInfoCache.get(cacheKey);
  }

  const blockInfo = window.roamAlphaAPI.pull(query, [":block/uid", blockUid]);
  blockInfoCache.set(cacheKey, blockInfo);
  return blockInfo;
};

// Helper to recursively build a tree of block nodes for visual copy
const getVisualBlockTree = (blockUid) => {
  if (!blockUid) return null;

  try {
    const blockInfo = getBlockInfoCached(
      blockUid,
      "[:block/string {:block/children [:block/uid :block/order]}]"
    );

    if (!blockInfo) return null;

    const node = {
      content: blockInfo[":block/string"] || "",
      children: []
    };

    if (blockInfo[":block/children"]) {
      const children = blockInfo[":block/children"];
      const sortedChildren = children.sort((a, b) => {
        return (a[":block/order"] || 0) - (b[":block/order"] || 0);
      });

      sortedChildren.forEach(child => {
        const childUid = child[":block/uid"];
        if (childUid) {
          const childNode = getVisualBlockTree(childUid);
          if (childNode) {
            node.children.push(childNode);
          }
        }
      });
    }

    return node;
  } catch (err) {
    console.error("Error in getVisualBlockTree:", err);
    return null;
  }
};

const getBlockUidFromElement = (container) => {
  try {
    if (!container) return null;
    const blockElement = container.querySelector('[id^="block-input-"]');
    if (blockElement) {
      const id = blockElement.id;
      const parts = id.split('-');
      return parts[parts.length - 1];
    }
  } catch (err) {
    console.error("Error in getBlockUidFromElement:", err);
  }
  return null;
};

const isDescendantOf = (childContainer, potentialAncestorContainer) => {
  try {
    if (!childContainer || !potentialAncestorContainer) return false;
    let current = childContainer.parentElement;
    while (current) {
      if (current === potentialAncestorContainer) return true;
      current = current.parentElement;
    }
  } catch (err) {
    console.error("Error in isDescendantOf:", err);
  }
  return false;
};

// Recursively find all descendant UIDs of a block
const getAllDescendantUids = (blockUid) => {
  if (!blockUid) return [];

  if (descendantsCache && descendantsCache.has(blockUid)) {
    return descendantsCache.get(blockUid);
  }

  const descendants = [];
  try {
    const blockInfo = getBlockInfoCached(blockUid, "[:block/uid {:block/children ...}]");
    if (blockInfo && blockInfo[":block/children"]) {
      blockInfo[":block/children"].forEach(child => {
        const childUid = child[":block/uid"];
        if (childUid) {
          descendants.push(childUid);
          descendants.push(...getAllDescendantUids(childUid));
        }
      });
    }
  } catch (err) {
    console.error("Error in getAllDescendantUids:", err);
  }

  if (descendantsCache) {
    descendantsCache.set(blockUid, descendants);
  }
  return descendants;
};

const findSelectedDescendants = (blockUid, selectedUids) => {
  const allDescendants = getAllDescendantUids(blockUid);
  return allDescendants.filter(uid => selectedUids.has(uid));
};

// Build selective path tree for visual copy
const buildVisualPathTree = (parentUid, targetUids) => {
  if (!parentUid || targetUids.size === 0) return null;

  try {
    const blockInfo = getBlockInfoCached(
      parentUid,
      "[:block/string {:block/children [:block/uid :block/order]}]"
    );

    if (!blockInfo) return null;

    const node = {
      content: blockInfo[":block/string"] || "",
      children: []
    };

    const isTarget = targetUids.has(parentUid);
    const descendants = getAllDescendantUids(parentUid);
    const hasTargetDescendants = descendants.some(desc => targetUids.has(desc));

    if (isTarget && !hasTargetDescendants) {
      // Leaf target - copy all children
      if (blockInfo[":block/children"]) {
        const sortedChildren = blockInfo[":block/children"].sort((a, b) => {
          return (a[":block/order"] || 0) - (b[":block/order"] || 0);
        });
        sortedChildren.forEach(child => {
          const childUid = child[":block/uid"];
          if (childUid) {
            const childNode = getVisualBlockTree(childUid);
            if (childNode) node.children.push(childNode);
          }
        });
      }
    } else {
      // Only process children on path to targets
      if (blockInfo[":block/children"]) {
        const sortedChildren = blockInfo[":block/children"].sort((a, b) => {
          return (a[":block/order"] || 0) - (b[":block/order"] || 0);
        });
        sortedChildren.forEach(child => {
          const childUid = child[":block/uid"];
          if (childUid) {
            const childDescendants = getAllDescendantUids(childUid);
            const hasTargetInBranch = targetUids.has(childUid) ||
              childDescendants.some(desc => targetUids.has(desc));
            if (hasTargetInBranch) {
              const childNode = buildVisualPathTree(childUid, targetUids);
              if (childNode) node.children.push(childNode);
            }
          }
        });
      }
    }

    return node;
  } catch (err) {
    console.error("Error in buildVisualPathTree:", err);
    return null;
  }
};

// Visual tree to Markdown
const visualTreeToMarkdown = (nodes, indentLevel = 0) => {
  let lines = [];
  const indent = '  '.repeat(indentLevel);

  nodes.forEach(node => {
    lines.push(`${indent}- ${node.content}`);
    if (node.children && node.children.length > 0) {
      lines.push(...visualTreeToMarkdown(node.children, indentLevel + 1));
    }
  });

  return lines;
};

// Visual tree to HTML
const visualTreeToHTML = (nodes) => {
  if (!nodes || nodes.length === 0) return '';
  let html = '<ul>';
  nodes.forEach(node => {
    let content = node.content
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\_\_(.*?)\_\_/g, '<i>$1</i>')
      .replace(/\^\^(.*?)\^\^/g, '<mark>$1</mark>');
    html += `<li>${content}`;
    if (node.children && node.children.length > 0) {
      html += visualTreeToHTML(node.children);
    }
    html += '</li>';
  });
  html += '</ul>';
  return html;
};

// Main copy function for visual selection (Alt+Shift+C)
// (Smart Copy functionality removed via user request)

// ============================================
// EXTENSION INITIALIZATION
// ============================================

const initExtension = () => {
  // Register commands in Command Palette
  if (window.roamAlphaAPI?.ui?.commandPalette) {
    // Main unified export command (with tabs)
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Smart Export",
      callback: unifiedExport,
      "disable-hotkey": false
    });

    // Export by root blocks (keep for now - different output format)
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Export by Root Blocks",
      callback: exportByRootBlocks,
      "disable-hotkey": false
    });
  }

  console.log("Roam Filter Export extension loaded (v2.28.0)");
};

const cleanupExtension = () => {
  if (window.roamAlphaAPI?.ui?.commandPalette) {
    window.roamAlphaAPI.ui.commandPalette.removeCommand({ label: "Smart Export" });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({ label: "Export by Root Blocks" });
  }

  console.log("Roam Filter Export extension unloaded");
};

// Make cleanup available globally
if (typeof window !== 'undefined') {
  window.roamExportFilterCleanup = cleanupExtension;
}

// Initialize
initExtension();