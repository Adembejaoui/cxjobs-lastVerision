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
  if (filters.contractType) {
    const types = filters.contractType.split(",").map((t) => t.trim()).filter(Boolean)
    if (types.length === 1) {
      (where as Record<string, unknown>).contractType = types[0]
    } else if (types.length > 1) {
      const existingOr = Array.isArray(where.OR) ? (where.OR as unknown[]) : []
      where.OR = [...existingOr, ...types.map((t) => ({ contractType: t }))]
    }
  }

  if (filters.employmentType) {
    const levels = filters.employmentType.split(",").map((l) => l.trim()).filter(Boolean)
    if (levels.length === 1) {
      (where as Record<string, unknown>).employmentType = levels[0]
    } else if (levels.length > 1) {
      const existingOr = Array.isArray(where.OR) ? (where.OR as unknown[]) : []
      where.OR = [...existingOr, ...levels.map((l) => ({ employmentType: l }))]
    }
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

  if (filters.location) {
    const locationOr = [
      { customLocation: { contains: filters.location, mode: "insensitive" } },
      { company: { location: { contains: filters.location, mode: "insensitive" } } },
    ];
    where.OR = [...(Array.isArray(where.OR) ? where.OR : []), ...locationOr];
  }

  if (filters.search) {
    where.OR = [
      ...(Array.isArray(where.OR) ? where.OR : []),
      {
        title: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
    ];
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
    const types = filters.activityType.split(",").map((t) => t.trim()).filter(Boolean)
    if (types.length === 1) {
      (where as Record<string, unknown>).activityType = types[0]
    } else if (types.length > 1) {
      const existingOr = Array.isArray(where.OR) ? (where.OR as unknown[]) : []
      where.OR = [...existingOr, ...types.map((t) => ({ activityType: t }))]
    }
  }

  if (where.OR) {
    andConditions.push({ OR: where.OR });
    delete where.OR;
  }

  andConditions.push({
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  });

  where.AND = andConditions;
}
