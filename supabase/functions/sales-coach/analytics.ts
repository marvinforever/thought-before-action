// ============================================
// DETERMINISTIC ANALYTICS HANDLERS
// ============================================

import { queryCache, repSummaryKey, repExistsKey, QueryTimeoutError, TIMEOUT_USER_MESSAGE } from "./cache.ts";

// ============================================
// SELF-LOOKUP: "my customers" / "my territory" / "my accounts"
// Fires when the logged-in rep asks about THEIR OWN data
// (no third-party name pattern — that's handled by handleRepCustomerListQuery)
// ============================================

export async function handleMyCustomerListQuery(
  message: string,
  client: any,
  userId: string | null,
  companyId: string | null
): Promise<string | null> {
  if (!userId || !companyId) return null;

  const lowerMsg = message.toLowerCase();

  // Must contain "my" possessive + a customer/territory signal
  // AND must NOT already contain a third-person name pattern (that goes to handleRepCustomerListQuery)
  const myCustomerPatterns = [
    /\bmy\s+(?:customer|account|client|grower|territory|book)\b/i,
    /\bmy\s+(?:full\s+)?(?:list|portfolio|base)\b/i,
    /\b(?:show|pull|give|get|list|see)\s+(?:me\s+)?(?:my|all\s+my)\s+(?:customers?|accounts?|growers?|clients?|territory|data|history|records?|sales|numbers?)\b/i,
    /\bwhat\s+(?:did\s+i|have\s+i)\s+(?:sell|sold|do|made?)\b/i,
    /\bmy\s+(?:purchase|sales|buying|order)\s*(?:history|data|records?)\b/i,
    /\b(?:all\s+)?my\s+(?:2024|2025|2026|2023|2022|last\s+year|this\s+year)\s+(?:customers?|accounts?|data|sales|numbers?)\b/i,
    /\bbring\s+up\s+(?:the\s+)?(?:my\s+)?(?:customer|account|grower)\s+list\b/i,
    /\bwho\s+(?:are|do)\s+i\s+(?:sell|service|cover|manage|work\s+with)\b/i,
    /\bmy\s+(?:top|biggest|largest)\b/i,
    /\bhow\s+(?:much|many)\s+(?:did|have)\s+i\s+(?:sell|sold|do|made?)\b/i,
    /\bmy\s+(?:total\s+)?(?:revenue|sales|volume|business)\b/i,
  ];

  const hasSelfQuery = myCustomerPatterns.some((p) => p.test(lowerMsg));
  if (!hasSelfQuery) return null;

  // Don't intercept if there's a specific third-party name mentioned (e.g. "Ed's customers")
  // Those are handled by handleRepCustomerListQuery
  const thirdPartyPattern = /(\w+)[''']s\s+(?:customer|account|client|grower|territory)/i;
  if (thirdPartyPattern.test(message)) return null;

  console.log("[My Customer List] Self-lookup detected");

  try {
    // Get the logged-in rep's name to find their records
    const { data: userProfile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const repName = userProfile?.full_name?.toUpperCase() || null;
    if (!repName) return null;

    const repFirstName = repName.split(" ")[0];

    const repData = await queryCache.getOrFetch(
      repSummaryKey(companyId, repFirstName),
      async () => {
        const { data, error } = await client.rpc("get_rep_customer_summary", {
          p_company_id: companyId,
          p_rep_first_name: repFirstName,
        });
        if (error) throw error;
        return data;
      }
    );

    if (!repData || repData.length === 0) {
      return `I don't see any purchase history data linked to your name (${repName}). Make sure your name in your profile matches the rep name in the imported sales data.`;
    }

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

    const totalRevenue = repData.reduce((sum: number, row: any) => sum + (Number(row.total_revenue) || 0), 0);
    const totalCustomers = repData.length;
    const actualRepName = repData[0].rep_name;

    // Check if they want a specific year filtered
    const yearMatch = lowerMsg.match(/\b(202[0-9]|201[0-9]|last\s+year|this\s+year)\b/);

    let response = `## ${actualRepName}'s Customer List\n\n`;
    response += `**${totalCustomers} customers** | **Total Revenue: ${fmt(totalRevenue)}**\n\n`;
    response += `| Rank | Customer | Total Revenue | Transactions |\n|------|----------|--------------|----------|\n`;

    repData.slice(0, 50).forEach((row: any, idx: number) => {
      response += `| ${idx + 1} | ${row.customer_name} | ${fmt(Number(row.total_revenue) || 0)} | ${row.transaction_count} |\n`;
    });

    if (totalCustomers > 50) {
      response += `\n*...and ${totalCustomers - 50} more customers. Ask about a specific customer for detailed history.*`;
    }

    response += `\n\n---\nAsk me about any specific customer for their full purchase history, top products, and year-by-year breakdown.`;

    return response;
  } catch (err) {
    console.error("[My Customer List] Error:", err);
    return null;
  }
}

export async function handleParetoAnalysis(
  message: string,
  client: any,
  userId: string | null,
  companyId: string | null
): Promise<string | null> {
  if (!userId || !companyId) return null;

  const lowerMsg = message.toLowerCase();

  const paretoPatterns = [
    /make\s+up\s+(\d+)\s*%/i,
    /top\s+(\d+)\s*%/i,
    /(\d+)\s*\/\s*20/i,
    /80\s*-?\s*20/i,
    /pareto/i,
    /who\s+(?:are|makes?|represents?)\s+.*?(?:top|biggest|largest)/i,
    /biggest\s+customers?/i,
    /top\s+(?:\w+\s+)?(?:customers?|growers?|accounts?)/i,
    /largest\s+(?:\w+\s+)?(?:customers?|growers?|accounts?)/i,
    /(?:customers?|accounts?|growers?)\s+by\s+(?:revenue|sales|volume)/i,
    /represent(?:s)?\s+\d+\s*%/i,
    /(?:bring|pull|show|give|get|list)\s+.*?(?:top|biggest|largest)\s+.*?(?:customer|account|grower)/i,
    /top\s+\d+\s+(?:\w+\s+)?(?:by\s+)?(?:revenue|sales|volume)/i,
  ];

  const isParetoQuery = paretoPatterns.some((p) => p.test(lowerMsg));
  if (!isParetoQuery) return null;

  console.log("[Pareto Analysis] Detected query");

  // ── Extract "top N" count (number or word) ──
  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, twenty5: 25,
    twentyfive: 25, thirty: 30, fifty: 50,
  };
  let topNLimit: number | null = null;
  const topNDigitMatch = lowerMsg.match(/top\s+(\d+)\s+(?!%)/);
  if (topNDigitMatch) {
    topNLimit = parseInt(topNDigitMatch[1], 10);
  } else {
    const topNWordMatch = lowerMsg.match(/top\s+(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|fifty)\b/i);
    if (topNWordMatch) {
      topNLimit = wordToNum[topNWordMatch[1].toLowerCase()] || null;
    }
  }

  // ── Extract year filter ──
  let yearFilter: number | null = null;
  const yearMatch = lowerMsg.match(/\b(20[1-3]\d)\b/);
  if (yearMatch) {
    yearFilter = parseInt(yearMatch[1], 10);
  } else if (/\bthis\s+year\b/.test(lowerMsg)) {
    yearFilter = new Date().getFullYear();
  } else if (/\blast\s+year\b/.test(lowerMsg)) {
    yearFilter = new Date().getFullYear() - 1;
  }

  // ── Percentage target (only if no top-N was specified) ──
  let targetPercent = 80;
  let isPercentMode = false;
  if (!topNLimit) {
    const percentMatch = lowerMsg.match(/(\d+)\s*%/) || lowerMsg.match(/(\d+)\s*\/\s*20/);
    if (percentMatch) {
      const extracted = parseInt(percentMatch[1], 10);
      if (extracted > 0 && extracted <= 100) { targetPercent = extracted; isPercentMode = true; }
    }
  }

  console.log(`[Pareto Analysis] topN=${topNLimit}, year=${yearFilter}, percent=${isPercentMode ? targetPercent : 'N/A'}`);

  try {
    const { data: userProfile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const repName = userProfile?.full_name?.toUpperCase() || null;
    const repFirstName = repName ? repName.split(" ")[0] : "";

    let sortedCustomers: { name: string; revenue: number }[];

    if (yearFilter) {
      // ── Year-filtered query: go direct to the table ──
      const startDate = `${yearFilter}-01-01`;
      const endDate = `${yearFilter}-12-31`;

      const { data: yearData, error: yearError } = await client
        .from("customer_purchase_history")
        .select("customer_name, amount")
        .eq("company_id", companyId)
        .ilike("rep_name", `${repFirstName}%`)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate);

      if (yearError) throw yearError;

      if (!yearData || yearData.length === 0) {
        return `I don't have any purchase history data for ${repName || "your account"} in ${yearFilter}. Make sure your ${yearFilter} sales data has been imported.`;
      }

      // Aggregate by customer name
      const customerMap = new Map<string, number>();
      for (const row of yearData) {
        const name = row.customer_name;
        const amt = Number(row.amount) || 0;
        customerMap.set(name, (customerMap.get(name) || 0) + amt);
      }

      sortedCustomers = Array.from(customerMap.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue);
    } else {
      // ── All-time: use cached RPC ──
      const cacheKey = repSummaryKey(companyId, repFirstName);
      const repData = await queryCache.getOrFetch(
        cacheKey,
        async () => {
          const { data, error } = await client.rpc("get_rep_customer_summary", {
            p_company_id: companyId,
            p_rep_first_name: repFirstName,
          });
          if (error) throw error;
          return data;
        }
      );

      if (!repData || repData.length === 0) {
        return `I don't have any purchase history data for ${repName || "your account"}. Ensure your sales data is imported and your name matches the rep name in the data.`;
      }

      sortedCustomers = repData.map((row: any) => ({
        name: row.customer_name,
        revenue: Number(row.total_revenue) || 0,
      }));
    }

    const totalRevenue = sortedCustomers.reduce((sum, c) => sum + c.revenue, 0);

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

    if (topNLimit) {
      // ── Top-N mode: just take the first N ──
      const topN = sortedCustomers.slice(0, topNLimit);
      const topNRevenue = topN.reduce((sum, c) => sum + c.revenue, 0);
      const topNPercent = totalRevenue > 0 ? ((topNRevenue / totalRevenue) * 100).toFixed(1) : "0";
      const yearLabel = yearFilter ? ` (${yearFilter})` : "";

      let response = `## Your Top ${topNLimit} Customers${yearLabel}\n\n`;
      response += `**${topN.length} customers** represent **${topNPercent}%** of your${yearLabel} revenue.\n\n`;
      response += `**Total Revenue${yearLabel}:** ${fmt(totalRevenue)}\n`;
      response += `**Top ${topN.length} Combined:** ${fmt(topNRevenue)}\n\n`;
      response += `| Rank | Customer | Revenue | % of Total |\n|------|----------|---------|------------|\n`;

      topN.forEach((c, idx) => {
        const pct = totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) : "0";
        response += `| ${idx + 1} | ${c.name} | ${fmt(c.revenue)} | ${pct}% |\n`;
      });

      if (sortedCustomers.length > topNLimit) {
        response += `\n*${sortedCustomers.length - topNLimit} more customers not shown.*`;
      }

      response += `\n\n---\nAsk about any specific customer for their full purchase history and product breakdown.`;
      return response;
    }

    // ── Percentage / Pareto mode ──
    const targetRevenue = (targetPercent / 100) * totalRevenue;
    let cumulativeRevenue = 0;
    const topCustomers: { name: string; revenue: number; percent: number }[] = [];

    for (const c of sortedCustomers) {
      topCustomers.push({ name: c.name, revenue: c.revenue, percent: (c.revenue / totalRevenue) * 100 });
      cumulativeRevenue += c.revenue;
      if (cumulativeRevenue >= targetRevenue) break;
    }

    const customerPercent = ((topCustomers.length / sortedCustomers.length) * 100).toFixed(1);
    const actualRevenuePercent = ((cumulativeRevenue / totalRevenue) * 100).toFixed(1);
    const yearLabel = yearFilter ? ` (${yearFilter})` : "";

    let response = `## Your Top ${targetPercent}% Revenue Analysis${yearLabel}\n\n`;
    response += `**${topCustomers.length} customers** (${customerPercent}% of ${sortedCustomers.length} total) make up **${actualRevenuePercent}%** of your${yearLabel} revenue.\n\n`;
    response += `**Total Revenue${yearLabel}:** ${fmt(totalRevenue)}\n`;
    response += `**Top ${topCustomers.length} Combined:** ${fmt(cumulativeRevenue)}\n\n`;
    response += `### Your Top Customers:\n\n| Rank | Customer | Revenue | % of Total |\n|------|----------|---------|------------|\n`;

    topCustomers.forEach((c, idx) => {
      response += `| ${idx + 1} | ${c.name} | ${fmt(c.revenue)} | ${c.percent.toFixed(1)}% |\n`;
    });

    response += `\n---\n**Key Insight:** These ${topCustomers.length} accounts are your bread and butter. Focus here first, then grow accounts just outside this tier.`;

    return response;
  } catch (err) {
    console.error("[Pareto Analysis] Error:", err);
    return null;
  }
}

export async function handleRepCustomerListQuery(
  message: string,
  client: any,
  userId: string | null,
  companyId: string | null
): Promise<string | null> {
  if (!userId || !companyId) return null;

  const lowerMsg = message.toLowerCase();

  // Detect "Ed's customer list" / "show me Ed's customers" / "list of Ed's accounts" etc.
  const repListPatterns = [
    /(\w+)[''']s\s+(?:customer|account|client|grower|territory)\s+(?:list|accounts?|customers?|base)/i,
    /(?:show|give|pull|get)\s+(?:me\s+)?(\w+)[''']s\s+(?:customers?|accounts?|clients?|growers?)/i,
    /(?:customers?|accounts?|clients?|growers?)\s+(?:for|assigned to|under|belonging to|of)\s+(\w+)/i,
    /(\w+)[''']s\s+(?:territory|book\s+of\s+business|book)/i,
    /what\s+(?:customers?|accounts?)\s+(?:does|did)\s+(\w+)\s+(?:have|manage|cover|service)/i,
    /(?:list|show|pull|get)\s+(?:all\s+)?(?:customers?|accounts?|growers?)\s+(?:for|under|of)\s+(\w+)/i,
    /(\w+)[''']s?\s+(?:historical\s+)?(?:customer\s+data|sales\s+data|history|data)/i,
    /(?:data|history|records?)\s+(?:for|on|about)\s+(\w+)(?:\s|$)/i,
    /who\s+(?:are|is)\s+(\w+)[''']s?\s+(?:customers?|accounts?|clients?|growers?)/i,
    /(\w+)\s+(?:rep|representative|agent)\s+(?:customer|account|territory|grower)\s+(?:list|data)/i,
  ];

  let repFirstName: string | null = null;
  for (const pattern of repListPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Skip common words that aren't names
      if (/^(my|our|your|the|all|each|every|some|this|that)$/i.test(candidate)) continue;
      repFirstName = candidate;
      break;
    }
  }

  // Broader fallback: check if the message mentions a word that looks like a name
  // near data/history/customer keywords
  if (!repFirstName) {
    const generalDataPatterns = [
      /(?:historical|purchase|sales|customer|account|territory)\s+(?:data|history|info|information|records?|list)\s+(?:for|on|about|of)\s+(\w{3,})/i,
      /(?:about|for|on)\s+(\w{3,})[''']?s?\s+(?:data|history|customers?|accounts?|territory|growers?)/i,
      /(?:anything|something|everything)\s+(?:about|for|on)\s+(\w{3,})(?:\s|$)/i,
      /(?:show|tell|give)\s+(?:me\s+)?(?:info|data|history)\s+(?:on|for|about)\s+(\w{3,})/i,
    ];
    for (const pattern of generalDataPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (/^(my|our|your|the|all|each|every|some|this|that|it|him|her|them)$/i.test(candidate)) continue;
        repFirstName = candidate;
        break;
      }
    }
  }

  if (!repFirstName) return null;

  // Verify this first name matches an actual rep — use cache to avoid repeated validation queries
  const existsKey = repExistsKey(companyId, repFirstName);
  const repCheck = await queryCache.getOrFetch(
    existsKey,
    async () => {
      const { data } = await client
        .from("customer_purchase_history")
        .select("rep_name")
        .eq("company_id", companyId)
        .ilike("rep_name", `${repFirstName}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    10 * 60 * 1000 // 10 min TTL — rep roster changes rarely
  );

  // If no rep found with that first name, don't intercept
  if (!repCheck) return null;

  console.log(`[Rep Customer List] Detected query for rep: ${repFirstName}`);

  try {
    // Single RPC call with caching — DB does all aggregation, no row transfer
    const cacheKey = repSummaryKey(companyId, repFirstName);
    const repData = await queryCache.getOrFetch(
      cacheKey,
      async () => {
        const { data, error } = await client.rpc("get_rep_customer_summary", {
          p_company_id: companyId,
          p_rep_first_name: repFirstName,
        });
        if (error) throw error;
        return data;
      }
    );

    if (!repData || repData.length === 0) {
      return null; // Let the normal flow handle it
    }

    const actualRepName = repData[0].rep_name;
    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

    const totalRevenue = repData.reduce((sum: number, row: any) => sum + (Number(row.total_revenue) || 0), 0);
    const totalCustomers = repData.length;

    let response = `## ${actualRepName}'s Customer List\n\n`;
    response += `**${totalCustomers} customers** | **Total Revenue: ${fmt(totalRevenue)}**\n\n`;
    response += `| Rank | Customer | Total Revenue | Transactions |\n|------|----------|--------------|----------|\n`;

    repData.slice(0, 50).forEach((row: any, idx: number) => {
      response += `| ${idx + 1} | ${row.customer_name} | ${fmt(Number(row.total_revenue) || 0)} | ${row.transaction_count} |\n`;
    });

    if (totalCustomers > 50) {
      response += `\n*...and ${totalCustomers - 50} more customers*`;
    }

    return response;
  } catch (err) {
    console.error("[Rep Customer List] Error:", err);
    return null;
  }
}

export async function handlePurchaseHistoryQuery(
  message: string,
  client: any,
  userId: string | null,
  companyId: string | null
): Promise<{ response: string; customerId: string | null; customerName: string | null } | null> {
  if (!userId || !companyId) return null;

  const purchasePatterns = [
    /(?:what|show me|tell me|give me)\s+(?:did|has|does)\s+(.+?)\s+(?:buy|bought|purchase|order)/i,
    /(.+?)\s*[']?s?\s+(?:purchase|buying|order)\s*(?:history|record|data)/i,
    /(?:purchase|order|buying)\s*(?:history|record)\s+(?:for|of|from)\s+(.+?)(?:\?|$)/i,
    /(?:what|which)\s+(?:products?|items?)\s+(?:did|has|does)\s+(.+?)\s+(?:buy|order|purchase)/i,
    /show\s+(?:me\s+)?(.+?)\s*[']?s?\s+(?:purchases?|orders?|history)/i,
    // "what has Bollig Brothers bought", "tell me about Lofstrom's history"
    /(?:tell me about|what about|info on|details? (?:on|for|about))\s+(.+?)(?:'s)?\s+(?:purchase|buying|order|history|data)/i,
    // "how much has [customer] spent"
    /how\s+much\s+(?:has|did|have)\s+(.+?)\s+(?:spent?|paid?|bought?|purchased?)/i,
  ];

  let customerName: string | null = null;
  for (const pattern of purchasePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      customerName = match[1].trim();
      break;
    }
  }

  if (!customerName) return null;

  // Clean up the extracted name — remove trailing noise words
  customerName = customerName.replace(/\s+(bought|buy|purchase|order|history|data|record|spent|paid).*$/i, "").trim();

  console.log("[Purchase History] Detected query for customer:", customerName);

  try {
    const nameParts = customerName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;
    const reversedName = lastName ? `${lastName}, ${firstName}` : customerName;

    // Build a list of search patterns to try, in priority order
    const searchPatterns: string[] = [];
    if (lastName) searchPatterns.push(`%${lastName}%`);      // "Lofstrom" matches "LOFSTROM, STEVE"
    searchPatterns.push(`%${customerName}%`);                  // Full name (e.g. "Bollig Brothers")
    if (firstName !== lastName && firstName.length > 2) searchPatterns.push(`%${firstName}%`);

    let summaryData: any[] | null = null;
    for (const pattern of searchPatterns) {
      const { data } = await client.rpc("get_customer_purchase_summary_v2", {
        p_company_id: companyId,
        p_customer_name_pattern: pattern,
      });
      console.log(`[Purchase History] Pattern "${pattern}" → revenue=${data?.[0]?.total_revenue}`);
      if (data?.[0] && Number(data[0].total_revenue) > 0) {
        summaryData = data;
        break;
      }
    }

    const summary = summaryData?.[0];

    if (summary && Number(summary.total_revenue) > 0) {
      const fmt = (n: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

      const totalRevenue = Number(summary.total_revenue) || 0;
      const txnCount = Number(summary.transaction_count) || 0;

      let response = `## Purchase History for ${customerName}\n\n`;
      response += `**Total Revenue:** ${fmt(totalRevenue)} across ${txnCount} transactions\n\n`;

      if (summary.yearly_totals) {
        response += `### By Year:\n`;
        const years = Object.entries(summary.yearly_totals as Record<string, number>)
          .sort((a, b) => String(b[0]).localeCompare(String(a[0])));
        for (const [yr, total] of years) {
          response += `- **${yr}:** ${fmt(Number(total))}\n`;
        }
      }

      if (summary.top_products) {
        const products = summary.top_products as Array<{ name: string; revenue: number; txn_count: number }>;
        if (products.length > 0) {
          response += `\n### Top Products:\n`;
          for (const p of products) {
            response += `- ${p.name}: ${fmt(Number(p.revenue))}\n`;
          }
        }
      }

      // Try to match to a sales_companies record for the customerId
      const { data: salesCompany } = await client
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", userId)
        .or(`name.ilike.%${customerName}%,name.ilike.%${reversedName}%`)
        .limit(1)
        .maybeSingle();

      return {
        response,
        customerId: salesCompany?.id || null,
        customerName: salesCompany?.name || customerName,
      };
    }

    // Fallback: search pipeline companies
    const { data: salesCompanies } = await client
      .from("sales_companies")
      .select("id, name")
      .eq("profile_id", userId)
      .or(`name.ilike.%${customerName}%,name.ilike.%${reversedName}%`);

    if (!salesCompanies || salesCompanies.length === 0) return null;

    const matchedCustomer = salesCompanies[0];

    // Try RPC with the matched company name
    const { data: matchedSummary } = await client.rpc("get_customer_purchase_summary_v2", {
      p_company_id: companyId,
      p_customer_name_pattern: `%${matchedCustomer.name}%`,
    });

    const ms = matchedSummary?.[0];

    if (!ms || Number(ms.total_revenue) === 0) {
      return {
        response: `I don't have any purchase history data for **${matchedCustomer.name}**. No purchase data has been imported for this customer yet.`,
        customerId: matchedCustomer.id,
        customerName: matchedCustomer.name,
      };
    }

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

    const totalRevenue = Number(ms.total_revenue) || 0;
    const txnCount = Number(ms.transaction_count) || 0;

    let response = `## Purchase History for ${matchedCustomer.name}\n\n`;
    response += `**Total Revenue:** ${fmt(totalRevenue)} across ${txnCount} transactions\n\n`;

    if (ms.yearly_totals) {
      response += `### By Year:\n`;
      const years = Object.entries(ms.yearly_totals as Record<string, number>)
        .sort((a, b) => String(b[0]).localeCompare(String(a[0])));
      for (const [yr, total] of years) {
        response += `- **${yr}:** ${fmt(Number(total))}\n`;
      }
    }

    if (ms.top_products) {
      const products = ms.top_products as Array<{ name: string; revenue: number; txn_count: number }>;
      if (products.length > 0) {
        response += `\n### Top Products:\n`;
        for (const p of products) {
          response += `- ${p.name}: ${fmt(Number(p.revenue))}\n`;
        }
      }
    }

    return { response, customerId: matchedCustomer.id, customerName: matchedCustomer.name };
  } catch (err) {
    console.error("[Purchase History] Error:", err);
    return null;
  }
}
