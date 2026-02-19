// ============================================
// DETERMINISTIC ANALYTICS HANDLERS
// ============================================

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
    /who\s+(?:are|makes?|represents?)\s+(?:my\s+)?(?:top|biggest|largest)/i,
    /biggest\s+customers?/i,
    /top\s+(?:customers?|growers?|accounts?)/i,
    /largest\s+(?:customers?|growers?|accounts?)\s+by\s+(?:revenue|sales|volume)/i,
  ];

  const isParetoQuery = paretoPatterns.some((p) => p.test(lowerMsg));
  if (!isParetoQuery) return null;

  console.log("[Pareto Analysis] Detected query");

  let targetPercent = 80;
  const percentMatch = lowerMsg.match(/(\d+)\s*%/) || lowerMsg.match(/(\d+)\s*\/\s*20/);
  if (percentMatch) {
    const extracted = parseInt(percentMatch[1], 10);
    if (extracted > 0 && extracted <= 100) targetPercent = extracted;
  }

  try {
    const { data: userProfile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const repName = userProfile?.full_name?.toUpperCase() || null;

    const pageSize = 1000;
    let from = 0;
    const allRows: any[] = [];

    while (true) {
      let query = client
        .from("customer_purchase_history")
        .select("customer_name, amount, rep_name")
        .eq("company_id", companyId);

      if (repName) query = query.ilike("rep_name", repName);

      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (allRows.length === 0) {
      return `I don't have any purchase history data for ${repName || "your account"}. Ensure your sales data is imported and your name matches the rep name in the data.`;
    }

    const revenueByCustomer = new Map<string, number>();
    for (const row of allRows) {
      const name = row.customer_name?.trim() || "Unknown";
      revenueByCustomer.set(name, (revenueByCustomer.get(name) || 0) + (Number(row.amount) || 0));
    }

    const sortedCustomers = Array.from(revenueByCustomer.entries()).sort((a, b) => b[1] - a[1]);
    const totalRevenue = sortedCustomers.reduce((sum, [, rev]) => sum + rev, 0);
    const targetRevenue = (targetPercent / 100) * totalRevenue;

    let cumulativeRevenue = 0;
    const topCustomers: { name: string; revenue: number; percent: number }[] = [];

    for (const [name, revenue] of sortedCustomers) {
      topCustomers.push({ name, revenue, percent: (revenue / totalRevenue) * 100 });
      cumulativeRevenue += revenue;
      if (cumulativeRevenue >= targetRevenue) break;
    }

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

    const customerPercent = ((topCustomers.length / sortedCustomers.length) * 100).toFixed(1);
    const actualRevenuePercent = ((cumulativeRevenue / totalRevenue) * 100).toFixed(1);

    let response = `## Your Top ${targetPercent}% Revenue Analysis\n\n`;
    response += `**${topCustomers.length} customers** (${customerPercent}% of ${sortedCustomers.length} total) make up **${actualRevenuePercent}%** of your revenue.\n\n`;
    response += `**Total Revenue:** ${fmt(totalRevenue)}\n`;
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
    /(?:customers?|accounts?|clients?|growers?)\s+(?:for|assigned to|under)\s+(\w+)/i,
    /(\w+)[''']s\s+(?:territory|book\s+of\s+business|book)/i,
    /what\s+(?:customers?|accounts?)\s+(?:does|did)\s+(\w+)\s+(?:have|manage|cover|service)/i,
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

  if (!repFirstName) return null;

  console.log(`[Rep Customer List] Detected query for rep: ${repFirstName}`);

  try {
    const pageSize = 1000;
    let from = 0;
    const allRows: any[] = [];

    while (true) {
      const { data, error } = await client
        .from("customer_purchase_history")
        .select("customer_name, amount, rep_name, year, sale_date")
        .eq("company_id", companyId)
        .ilike("rep_name", `${repFirstName}%`)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (allRows.length === 0) {
      return null; // Let the normal flow handle it
    }

    const actualRepName = allRows[0].rep_name;
    const revenueByCustomer = new Map<string, { total: number; count: number; lastYear: string }>();

    for (const row of allRows) {
      const name = row.customer_name?.trim() || "Unknown";
      const amt = Number(row.amount) || 0;
      const yr = row.year || (row.sale_date ? row.sale_date.substring(0, 4) : "Unknown");
      const cur = revenueByCustomer.get(name) || { total: 0, count: 0, lastYear: "" };
      cur.total += amt;
      cur.count += 1;
      if (!cur.lastYear || String(yr) > cur.lastYear) cur.lastYear = String(yr);
      revenueByCustomer.set(name, cur);
    }

    const sortedCustomers = Array.from(revenueByCustomer.entries()).sort((a, b) => b[1].total - a[1].total);
    const totalRevenue = sortedCustomers.reduce((sum, [, d]) => sum + d.total, 0);

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

    let response = `## ${actualRepName}'s Customer List\n\n`;
    response += `**${sortedCustomers.length} customers** | **Total Revenue: ${fmt(totalRevenue)}**\n\n`;
    response += `| Rank | Customer | Total Revenue | Transactions |\n|------|----------|--------------|----------|\n`;

    sortedCustomers.slice(0, 50).forEach(([name, data], idx) => {
      response += `| ${idx + 1} | ${name} | ${fmt(data.total)} | ${data.count} |\n`;
    });

    if (sortedCustomers.length > 50) {
      response += `\n*...and ${sortedCustomers.length - 50} more customers*`;
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
    /(?:what|show me|tell me|give me)\s+(?:did|has|does)\s+(\w+(?:\s+\w+)?)\s+(?:buy|bought|purchase|order)/i,
    /(\w+(?:\s+\w+)?)\s*[']?s?\s+(?:purchase|buying|order)\s*(?:history|record|data)/i,
    /(?:purchase|order|buying)\s*(?:history|record)\s+(?:for|of|from)\s+(\w+(?:\s+\w+)?)/i,
    /(?:what|which)\s+(?:products?|items?)\s+(?:did|has|does)\s+(\w+(?:\s+\w+)?)\s+(?:buy|order|purchase)/i,
    /show\s+(?:me\s+)?(\w+(?:\s+\w+)?)\s*[']?s?\s+(?:purchases?|orders?|history)/i,
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

  console.log("[Purchase History] Detected query for customer:", customerName);

  try {
    const nameParts = customerName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;
    const reversedName = lastName ? `${lastName}, ${firstName}` : customerName;

    const { data: directHistory } = await client
      .from("customer_purchase_history")
      .select("customer_name, year, amount, product_description, quantity, sale_date")
      .eq("company_id", companyId)
      .or(`customer_name.ilike.%${customerName}%,customer_name.ilike.%${reversedName}%`)
      .order("year", { ascending: false })
      .order("sale_date", { ascending: false })
      .limit(100);

    if (directHistory && directHistory.length > 0) {
      const actualCustomerName = directHistory[0].customer_name;
      const { data: salesCompany } = await client
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", userId)
        .or(`name.ilike.${actualCustomerName},name.ilike.${customerName}`)
        .limit(1)
        .single();

      const matchedCustomer = salesCompany || { id: null, name: actualCustomerName };

      const yearlyTotals = new Map<number, { amount: number; count: number }>();
      const productBreakdown = new Map<string, number>();

      for (const row of directHistory) {
        const year = row.year || new Date(row.sale_date).getFullYear();
        const amount = Number(row.amount) || 0;
        const product = row.product_description || "Unknown";
        const current = yearlyTotals.get(year) || { amount: 0, count: 0 };
        yearlyTotals.set(year, { amount: current.amount + amount, count: current.count + 1 });
        productBreakdown.set(product, (productBreakdown.get(product) || 0) + amount);
      }

      let response = `## Purchase History for ${actualCustomerName}\n\n### Yearly Summary\n`;
      const sortedYears = Array.from(yearlyTotals.entries()).sort((a, b) => b[0] - a[0]);
      for (const [year, data] of sortedYears) {
        response += `- **${year}**: $${data.amount.toLocaleString()} (${data.count} transactions)\n`;
      }

      const topProducts = Array.from(productBreakdown.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (topProducts.length > 0) {
        response += `\n### Top Products\n`;
        for (const [product, total] of topProducts) {
          response += `- ${product}: $${total.toLocaleString()}\n`;
        }
      }

      return { response, customerId: matchedCustomer.id, customerName: actualCustomerName };
    }

    // Fallback: search pipeline
    const { data: salesCompanies } = await client
      .from("sales_companies")
      .select("id, name")
      .eq("profile_id", userId)
      .or(`name.ilike.%${customerName}%,name.ilike.%${reversedName}%`);

    if (!salesCompanies || salesCompanies.length === 0) return null;

    const matchedCustomer = salesCompanies[0];

    const { data: history } = await client
      .from("customer_purchase_history")
      .select("year, amount, product_description, quantity, sale_date")
      .eq("company_id", companyId)
      .or(`customer_name.ilike.${matchedCustomer.name},customer_name.ilike.%${matchedCustomer.name}%`)
      .order("year", { ascending: false })
      .limit(100);

    if (!history || history.length === 0) {
      return {
        response: `I don't have any purchase history data for **${matchedCustomer.name}**. No purchase data has been imported for this customer yet.`,
        customerId: matchedCustomer.id,
        customerName: matchedCustomer.name,
      };
    }

    const yearlyTotals = new Map<number, { amount: number; count: number }>();
    const productBreakdown = new Map<string, number>();

    for (const row of history) {
      const year = row.year || new Date(row.sale_date).getFullYear();
      const amount = Number(row.amount) || 0;
      const product = row.product_description || "Unknown";
      const current = yearlyTotals.get(year) || { amount: 0, count: 0 };
      yearlyTotals.set(year, { amount: current.amount + amount, count: current.count + 1 });
      productBreakdown.set(product, (productBreakdown.get(product) || 0) + amount);
    }

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

    const totalRevenue = Array.from(yearlyTotals.values()).reduce((sum, y) => sum + y.amount, 0);

    let response = `## Purchase History for ${matchedCustomer.name}\n\n**Total Revenue:** ${fmt(totalRevenue)} across ${history.length} transactions\n\n### By Year:\n`;
    const sortedYears = Array.from(yearlyTotals.entries()).sort((a, b) => b[0] - a[0]);
    for (const [year, data] of sortedYears) {
      response += `- **${year}:** ${fmt(data.amount)} (${data.count} transactions)\n`;
    }

    const sortedProducts = Array.from(productBreakdown.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sortedProducts.length > 0) {
      response += `\n### Top Products:\n`;
      for (const [product, amount] of sortedProducts) {
        response += `- ${product}: ${fmt(amount)}\n`;
      }
    }

    return { response, customerId: matchedCustomer.id, customerName: matchedCustomer.name };
  } catch (err) {
    console.error("[Purchase History] Error:", err);
    return null;
  }
}
