
# Agentic Product Training System - Full Implementation

## Overview

Transform the Bite-Sized Training section into a fully agentic, company-specific training creation system. Users select a **product** (dynamically parsed from their knowledge base) and optionally a **customer** to generate hyper-personalized training content explaining product value - suitable for training reps or sharing directly with customers as value-add MP3s.

**Universal Standard**: Your sales methodology training (ACAVE, discovery questions, objection handling) is global and available to all companies. Product training is company-specific.

---

## Changes Summary

| File | Change |
|------|--------|
| `src/components/sales/SalesAgentHeader.tsx` | Fix line 399 to use `viewAsCompanyId` for proper company isolation |
| `src/components/sales/SalesKnowledgePodcasts.tsx` | Add product extraction, replace dropdowns (Product + Customer), add product-specific generation |
| `supabase/functions/generate-sales-podcast/index.ts` | Add `productName` parameter, extract product-specific content from catalogs |

---

## User Experience

### New Dropdown Layout

```text
+-----------------------------------------------------+
| [Product ▼]                  [Customer ▼]           |
|                                                     |
| Product:                     Customer:              |
|   All Training (default)       General (default)    |
|   ─────────────                ─────────────        |
|   Streamline Catalog:          Derek Holmgren       |
|     • BioVax                   Scott Robertson      |
|     • CropFit Complete         Mike Johnson         |
|     • SeedShield               ...                  |
|   Rob-See-Co Seed:                                  |
|     • Duracade                                      |
|     • SmartStax PRO                                 |
+-----------------------------------------------------+
```

### Combinations Enabled

- **Product + Customer** = "Here's why BioVax could help Derek's operation..."
- **Product only** = General product value training for any customer
- **Customer only** = General coaching for that customer (existing behavior)
- **Neither** = Standard methodology training (existing behavior)

---

## Technical Implementation

### 1. Fix Company Isolation (SalesAgentHeader.tsx)

**Current (Line 399)**:
```tsx
<SalesKnowledgePodcasts 
  userId={viewAsUserId || user?.id} 
  companyId={profile?.company_id}  // ← Always uses logged-in user's company
/>
```

**Fixed**:
```tsx
<SalesKnowledgePodcasts 
  userId={viewAsUserId || user?.id} 
  companyId={viewAsCompanyId || profile?.company_id}  // ← Respects View As
/>
```

### 2. Dynamic Product Extraction (SalesKnowledgePodcasts.tsx)

Add logic to parse product names from knowledge base markdown:

```typescript
interface ExtractedProduct {
  name: string;
  knowledgeId: string;
  source: string; // Parent catalog title
}

const extractedProducts = useMemo((): ExtractedProduct[] => {
  const products: ExtractedProduct[] = [];
  
  for (const item of knowledge) {
    if (!isProductTraining(item.category)) continue;
    
    // Extract ### headers (product names) from markdown
    const productMatches = item.content.match(/###\s*([^\n(]+)/g);
    if (productMatches) {
      for (const match of productMatches) {
        const name = match.replace(/###\s*/, '').trim();
        if (name.length > 2 && name.length < 60) {
          products.push({
            name,
            knowledgeId: item.id,
            source: item.title
          });
        }
      }
    }
  }
  return products;
}, [knowledge]);
```

### 3. New Dropdown UI (SalesKnowledgePodcasts.tsx)

Replace the current "General training" and "No specific deal" dropdowns with:

**Product Dropdown**:
- "All Training" (default)
- Products grouped by source catalog

**Customer Dropdown**:
- "General" (no personalization)
- All customers from pipeline

Add new state:
```typescript
const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
```

### 4. Edge Function Update (generate-sales-podcast)

Add `productName` parameter to focus training on a specific product:

```typescript
const { knowledgeId, chunkIndex = 0, dealId, customerId, productName } = await req.json();

// If productName provided, extract just that product's section
let contentToUse = knowledge.content;
if (productName) {
  const productSection = extractProductSection(knowledge.content, productName);
  if (productSection) {
    contentToUse = productSection;
  }
}

// Helper function
function extractProductSection(content: string, productName: string): string | null {
  const regex = new RegExp(`###\\s*${productName}[^#]*`, 'i');
  const match = content.match(regex);
  return match ? match[0] : null;
}
```

Update AI prompts to emphasize value proposition when product is specified:
```typescript
if (productName) {
  systemContext += `\n\nFOCUS: You're teaching about ${productName} specifically. 
Explain its value proposition, key benefits, and when/how to recommend it to customers.
Make it practical - give the rep specific talking points they can use.`;
}
```

### 5. Filtering Logic

When a product is selected, filter the displayed training modules:
```typescript
const filteredKnowledge = selectedKnowledgeId 
  ? knowledge.filter(k => k.id === selectedKnowledgeId)
  : knowledge;
```

Update generation call to include product name:
```typescript
const response = await supabase.functions.invoke("generate-sales-podcast", {
  body: { 
    knowledgeId: selectedKnowledgeId || item.id, 
    chunkIndex: episodeIndex,
    customerId: selectedCustomerId,
    productName: selectedProductName,  // NEW
  },
});
```

---

## What Each Company Sees

| Company | Products Dropdown | Customers Dropdown | Sales Training |
|---------|-------------------|-------------------|----------------|
| Streamline | Rob-See-Co products, Streamline catalog | Streamline customers | Global (your methodology) |
| Momentum | Tidal Grow, AllChem products | Momentum customers | Global (your methodology) |
| Any Company | Their own product catalogs | Their own customers | Global (your methodology) |

---

## How It Works End-to-End

1. **Rep opens Training tab** → Products parsed from their company's knowledge base
2. **Selects "BioVax" + "Derek Holmgren"** → UI shows personalized mode banner
3. **Clicks "Create Episodes"** → Edge function:
   - Fetches BioVax section from Streamline catalog
   - Fetches Derek's operation details
   - AI generates 3-5 episodes: "Why BioVax Fits Derek's Operation", "Talking Points for Your Call", etc.
4. **Rep downloads MP3** → Shares with Derek or listens during commute

---

## Edge Cases Handled

- **No products found**: Falls back to full catalog articles
- **Product with unusual formatting**: Uses whole article if section extraction fails
- **Viewing as another company**: Products/customers update correctly
- **Empty customer selection**: General product training (no personalization)

