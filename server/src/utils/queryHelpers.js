export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseDateRange(from, to) {
  if (!from && !to) return null;

  const range = {};
  if (from) {
    range.$gte = new Date(from);
  }
  if (to) {
    // If date-only YYYY-MM-DD is provided, treat it as inclusive through end of UTC day.
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(to);
    const toDate = new Date(isDateOnly ? `${to}T23:59:59.999Z` : to);
    range.$lte = toDate;
  }
  return range;
}

export function buildPaginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
