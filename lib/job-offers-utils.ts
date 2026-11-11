export function getSortOrder(sort?: string) {
  switch (sort) {
    case "oldest":
      return { createdAt: "asc" as const };
    case "salary-high":
      return { salaryMax: "desc" as const };
    case "salary-low":
      return { salaryMin: "asc" as const };
    case "newest":
    default:
      return { createdAt: "desc" as const };
  }
}

export function buildJobOfferWhereClause(baseWhere: Record<string, unknown>, filters: {
  contractType?: string | undefined;
  employmentType?: string | undefined;
  isRemote?: boolean | undefined;
  isHybrid?: boolean | undefined;
  salaryMin?: number | undefined;
  salaryMax?: number | undefined;
  location?: string | undefined;
  search?: string | undefined;
  language?: string | undefined;
  activityType?: string | undefined;
}, now: Date) {
  const where = { ...baseWhere };
  const andConditions: object[] = [];

  applyJobOfferFilters(where, andConditions, filters, now);

  return { where, andConditions };
}

export function applyJobOfferFilters(
  where: Record<string, unknown>,
  andConditions: object[],
  filters: {
    contractType?: string | undefined;
    employmentType?: string | undefined;
    isRemote?: boolean | undefined;
    isHybrid?: boolean | undefined;
    salaryMin?: number | undefined;
    salaryMax?: number | undefined;
    location?: string | undefined;
    search?: string | undefined;
    language?: string | undefined;
    activityType?: string | undefined;
  },
  now: Date
) {
  // Semantics: values WITHIN one filter are alternatives (OR / `in`); different
  // filters must ALL match (AND). Each group therefore gets its own entry in
  // `andConditions`. (Previously every group was appended to a single shared
  // `OR`, so e.g. search=agent&location=Tunis matched jobs satisfying EITHER.)
  const csv = (value: string) => value.split(",").map((t) => t.trim()).filter(Boolean);

  if (filters.contractType) {
    const types = csv(filters.contractType);
    if (types.length > 0) andConditions.push({ contractType: { in: types } });
  }

  if (filters.employmentType) {
    const levels = csv(filters.employmentType);
    if (levels.length > 0) andConditions.push({ employmentType: { in: levels } });
  }

  if (filters.isRemote !== undefined) {
    where.isRemote = filters.isRemote;
  }

  if (filters.isHybrid !== undefined) {
    where.isHybrid = filters.isHybrid;
  }

  if (filters.salaryMin !== undefined || filters.salaryMax !== undefined) {
    const salaryAnd: object[] = [];
    if (filters.salaryMin !== undefined) {
      salaryAnd.push({ salaryMax: { gte: filters.salaryMin } });
    }
    if (filters.salaryMax !== undefined) {
      salaryAnd.push({ salaryMin: { lte: filters.salaryMax } });
    }
    andConditions.push({ AND: salaryAnd });
  }

  const location = filters.location?.trim();
  if (location) {
    andConditions.push({
      OR: [
        { customLocation: { contains: location, mode: "insensitive" } },
        { company: { location: { contains: location, mode: "insensitive" } } },
      ],
    });
  }

  const search = filters.search?.trim();
  if (search) {
    andConditions.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { company: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  if (filters.language) {
    where.languages = {
      some: {
        language: {
          contains: filters.language,
          mode: "insensitive",
        },
      },
    };
  }

  if (filters.activityType) {
    const types = csv(filters.activityType);
    if (types.length > 0) andConditions.push({ activityType: { in: types } });
  }

  andConditions.push({
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  });

  where.AND = andConditions;
}
