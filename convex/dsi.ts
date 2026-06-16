import { v } from "convex/values";
import { action, internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwner } from "./lib/auth";

type LocationSignal = {
  name: string;
  lat: number;
  lon: number;
  timezone: string;
  reason: string;
};

type WeatherSignal = {
  provider: string;
  location: LocationSignal;
  observedAt: string | null;
  tempF: number | null;
  windMph: number | null;
  code: number | null;
  label: string;
  sourceUrl: string;
};

type SurfSignal = {
  provider: string;
  breakName: string;
  location: LocationSignal;
  observedAt: string | null;
  ftRange: string | null;
  faceFt: number | null;
  waveHeightFt: number | null;
  swellHeightFt: number | null;
  periodSeconds: number | null;
  swellDirectionDegrees: number | null;
  windMph: number | null;
  windDirectionDegrees: number | null;
  windQuality: string;
  label: string;
  tide: {
    station: string;
    currentFt: number | null;
    observedAt: string | null;
    sourceUrl: string;
  };
  sourceUrls: string[];
};

function canonicalJsonString(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalJsonString).join(",") + "]";
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return "{" + keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonString((obj as Record<string, unknown>)[k])}`).join(",") + "}";
  }
  return String(obj);
}

async function snapshotHash(payload: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalJsonString(payload));
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ownerForUserId(ctx: QueryCtx | MutationCtx, clerkId: string, userId: Id<"users">): Promise<Doc<"users">> {
  await requireOwner(ctx, clerkId);
  const owner = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
  if (!owner || owner._id !== userId) throw new Error("not authorized: userId does not match authenticated user");
  return owner;
}

function ptDateParts(now = new Date()): { weekday: string; hour: number; minute: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    dateKey: `${get("year")}${get("month")}${get("day")}`,
  };
}

function currentHoustonLocation(now = new Date()): LocationSignal {
  const pt = ptDateParts(now);
  const weekday = !["Sat", "Sun"].includes(pt.weekday);
  const minutes = pt.hour * 60 + pt.minute;
  const inWorkWindow = weekday && minutes >= 9 * 60 + 30 && minutes <= 19 * 60 + 30;
  return inWorkWindow
    ? {
        name: "Venice Beach, CA",
        lat: 33.985,
        lon: -118.469,
        timezone: "America/Los_Angeles",
        reason: "weekday work-window default from h.computer",
      }
    : {
        name: "Mar Vista, CA",
        lat: 34,
        lon: -118.43,
        timezone: "America/Los_Angeles",
        reason: "home default from h.computer",
      };
}

function weatherLabel(code: number | null): string {
  if (code === null) return "unknown";
  if (code === 0) return "clear";
  if ([1, 2].includes(code)) return "mostly clear";
  if (code === 3) return "overcast";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "weather";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchWeather(): Promise<WeatherSignal> {
  const location = currentHoustonLocation();
  const sourceUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Los_Angeles`;
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Open-Meteo weather failed: ${res.status}`);
  const json = (await res.json()) as {
    current?: {
      time?: string;
      temperature_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
  };
  const code = numberOrNull(json.current?.weather_code);
  return {
    provider: "open-meteo",
    location,
    observedAt: json.current?.time ?? null,
    tempF: numberOrNull(json.current?.temperature_2m),
    windMph: numberOrNull(json.current?.wind_speed_10m),
    code,
    label: weatherLabel(code),
    sourceUrl,
  };
}

function classifyWind(direction: number | null, mph: number | null): string {
  if (mph !== null && mph < 4) return "glassy";
  if (direction === null) return "unknown";
  if (direction >= 30 && direction <= 110) return "offshore";
  if (direction >= 200 && direction <= 290) return "onshore";
  return "cross";
}

function shadowFactor(direction: number | null): number {
  if (direction === null) return 1;
  return direction >= 270 && direction <= 330 ? 0.85 : 1;
}

function surflineFaceFromHs(waveHeightFt: number | null, periodSeconds: number | null, direction: number | null): number | null {
  if (waveHeightFt === null) return null;
  const hs = waveHeightFt * shadowFactor(direction);
  const period = periodSeconds ?? 0;
  let face = hs <= 2.5 ? 0.8 + 1.1 * hs : hs <= 3.5 ? 0.4 + hs : 1.05 * hs;
  face += Math.min(0.1 * Math.max(0, period - 13), 1);
  return Math.round(face * 10) / 10;
}

function formatSurflineRange(faceFt: number | null): string | null {
  if (faceFt === null) return null;
  const roundedHalf = Math.round(faceFt * 2) / 2;
  const low = Math.max(0, Math.floor(roundedHalf));
  const high = low + 1;
  const plus = roundedHalf - low >= 0.5 ? "+" : "";
  return `${low}-${high}${plus}`;
}

function defaultSurfLabel(faceFt: number | null): string {
  if (faceFt === null) return "surf unknown";
  if (faceFt < 1.5) return "flat, paddle out for the vibes";
  if (faceFt < 3) return "small but fun";
  if (faceFt < 5) return "head high, worth it";
  return "overhead+, walled out";
}

function applyWindLabel(base: string, windQuality: string, faceFt: number | null): string {
  if (windQuality === "offshore" || windQuality === "glassy") return `${base} / clean`;
  if (windQuality === "onshore" && faceFt !== null && faceFt >= 1.5) return `${base} / blown out`;
  return base;
}

function nearestIndex(times: string[] | undefined, targetMs = Date.now()): number {
  if (!times?.length) return 0;
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times.length; i += 1) {
    const ms = Date.parse(times[i]);
    const delta = Number.isFinite(ms) ? Math.abs(ms - targetMs) : Number.POSITIVE_INFINITY;
    if (delta < bestDelta) {
      best = i;
      bestDelta = delta;
    }
  }
  return best;
}

async function fetchTide(): Promise<SurfSignal["tide"]> {
  const pt = ptDateParts();
  const sourceUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=you.md&station=9410840&begin_date=${pt.dateKey}&end_date=${pt.dateKey}&datum=MLLW&time_zone=lst_ldt&units=english&interval=h&format=json`;
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`NOAA tide failed: ${res.status}`);
    const json = (await res.json()) as { predictions?: Array<{ t?: string; v?: string }> };
    const predictions = json.predictions ?? [];
    const best = predictions[nearestIndex(predictions.map((p) => p.t ?? ""))];
    return {
      station: "9410840",
      currentFt: best?.v ? Number(best.v) : null,
      observedAt: best?.t ?? null,
      sourceUrl,
    };
  } catch {
    return { station: "9410840", currentFt: null, observedAt: null, sourceUrl };
  }
}

async function fetchSurf(): Promise<SurfSignal> {
  const location: LocationSignal = {
    name: "Venice Breakwater, CA",
    lat: 33.985,
    lon: -118.473,
    timezone: "America/Los_Angeles",
    reason: "home-break default from h.computer",
  };
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${location.lat}&longitude=${location.lon}&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction&daily=wave_height_max,wave_period_max,wave_direction_dominant&length_unit=imperial&timezone=America%2FLos_Angeles&forecast_days=16`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=16`;
  const [marineRes, weatherRes, tide] = await Promise.all([
    fetch(marineUrl, { signal: AbortSignal.timeout(15_000) }),
    fetch(weatherUrl, { signal: AbortSignal.timeout(15_000) }),
    fetchTide(),
  ]);
  if (!marineRes.ok) throw new Error(`Open-Meteo marine failed: ${marineRes.status}`);
  if (!weatherRes.ok) throw new Error(`Open-Meteo surf weather failed: ${weatherRes.status}`);

  const marine = (await marineRes.json()) as {
    hourly?: {
      time?: string[];
      wave_height?: number[];
      wave_period?: number[];
      wave_direction?: number[];
      swell_wave_height?: number[];
      swell_wave_period?: number[];
      swell_wave_direction?: number[];
    };
  };
  const weather = (await weatherRes.json()) as {
    hourly?: {
      time?: string[];
      wind_speed_10m?: number[];
      wind_direction_10m?: number[];
    };
  };

  const marineIndex = nearestIndex(marine.hourly?.time);
  const weatherIndex = nearestIndex(weather.hourly?.time);
  const waveHeightFt = numberOrNull(marine.hourly?.wave_height?.[marineIndex]);
  const periodSeconds = numberOrNull(marine.hourly?.swell_wave_period?.[marineIndex]) ?? numberOrNull(marine.hourly?.wave_period?.[marineIndex]);
  const direction = numberOrNull(marine.hourly?.swell_wave_direction?.[marineIndex]) ?? numberOrNull(marine.hourly?.wave_direction?.[marineIndex]);
  const windMph = numberOrNull(weather.hourly?.wind_speed_10m?.[weatherIndex]);
  const windDirection = numberOrNull(weather.hourly?.wind_direction_10m?.[weatherIndex]);
  const faceFt = surflineFaceFromHs(waveHeightFt, periodSeconds, direction);
  const windQuality = classifyWind(windDirection, windMph);
  const label = applyWindLabel(defaultSurfLabel(faceFt), windQuality, faceFt);

  return {
    provider: "open-meteo-marine",
    breakName: "Venice Breakwater",
    location,
    observedAt: marine.hourly?.time?.[marineIndex] ?? null,
    ftRange: formatSurflineRange(faceFt),
    faceFt,
    waveHeightFt,
    swellHeightFt: numberOrNull(marine.hourly?.swell_wave_height?.[marineIndex]),
    periodSeconds,
    swellDirectionDegrees: direction,
    windMph,
    windDirectionDegrees: windDirection,
    windQuality,
    label,
    tide,
    sourceUrls: [marineUrl, weatherUrl, tide.sourceUrl],
  };
}

async function insertSnapshot(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    connectorKind: string;
    sourceKey: string;
    sourceType: string;
    normalized: unknown;
    citations?: unknown[];
    visibility?: string;
    trustLevel?: string;
    metadata?: unknown;
  }
): Promise<Id<"sourceSnapshots">> {
  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  return await ctx.db.insert("sourceSnapshots", {
    userId: args.userId,
    connectorKind: args.connectorKind,
    sourceKey: args.sourceKey,
    sourceType: args.sourceType,
    windowStart,
    windowEnd,
    rawHash: await snapshotHash(args.normalized),
    normalized: args.normalized,
    citations: args.citations,
    visibility: args.visibility ?? "private",
    trustLevel: args.trustLevel ?? "verified",
    capturedAt: Date.now(),
    metadata: args.metadata,
  });
}

async function upsertComponent(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    slug: string;
    componentType: string;
    title: string;
    summary: string;
    data: unknown;
    sourceSnapshotIds: Id<"sourceSnapshots">[];
    trustLevel: string;
    metadata: unknown;
  }
): Promise<Id<"dsiComponents">> {
  const now = Date.now();
  const existing = await ctx.db
    .query("dsiComponents")
    .withIndex("by_userId_slug", (q) => q.eq("userId", args.userId).eq("slug", args.slug))
    .first();
  const patch = {
    componentType: args.componentType,
    title: args.title,
    summary: args.summary,
    data: args.data,
    sourceSnapshotIds: args.sourceSnapshotIds,
    visibility: existing?.visibility ?? "private",
    status: existing?.status ?? "active",
    trustLevel: args.trustLevel,
    capturedAt: now,
    updatedAt: now,
    metadata: args.metadata,
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }
  return await ctx.db.insert("dsiComponents", {
    userId: args.userId,
    slug: args.slug,
    ...patch,
  });
}

export const listComponents = query({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ownerForUserId(ctx, args.clerkId, args.userId);
    return await ctx.db
      .query("dsiComponents")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 40, 1), 100));
  },
});

export const refreshWeatherSurf = action({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ weatherComponentId: Id<"dsiComponents">; surfComponentId: Id<"dsiComponents">; snapshotIds: Id<"sourceSnapshots">[] }> => {
    await requireOwner(ctx, args.clerkId);
    const [weather, surf] = await Promise.all([fetchWeather(), fetchSurf()]);
    return await ctx.runMutation(internal.dsi.persistWeatherSurfComponents, {
      clerkId: args.clerkId,
      userId: args.userId,
      weather,
      surf,
    });
  },
});

export const persistWeatherSurfComponents = internalMutation({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
    weather: v.any(),
    surf: v.any(),
  },
  handler: async (ctx, args): Promise<{ weatherComponentId: Id<"dsiComponents">; surfComponentId: Id<"dsiComponents">; snapshotIds: Id<"sourceSnapshots">[] }> => {
    await ownerForUserId(ctx, args.clerkId, args.userId);
    const weather = args.weather as WeatherSignal;
    const surf = args.surf as SurfSignal;
    const weatherSnapshotId = await insertSnapshot(ctx, {
      userId: args.userId,
      connectorKind: "weather",
      sourceKey: "home-weather",
      sourceType: "dsi_component",
      normalized: weather,
      citations: [{ provider: weather.provider, url: weather.sourceUrl }],
      visibility: "private",
      trustLevel: "verified",
      metadata: { origin: "h.computer", adapter: "open-meteo-weather" },
    });
    const surfSnapshotId = await insertSnapshot(ctx, {
      userId: args.userId,
      connectorKind: "surf",
      sourceKey: "venice-breakwater-surf",
      sourceType: "dsi_component",
      normalized: surf,
      citations: surf.sourceUrls.map((url) => ({ url })),
      visibility: "private",
      trustLevel: "computed",
      metadata: { origin: "h.computer", adapter: "open-meteo-marine-surfline-style" },
    });

    const weatherTemp = weather.tempF === null ? "--" : Math.round(weather.tempF).toString();
    const weatherWind = weather.windMph === null ? "--" : Math.round(weather.windMph).toString();
    const surfRange = surf.ftRange ?? "--";
    const surfPeriod = surf.periodSeconds === null ? "--" : Math.round(surf.periodSeconds).toString();
    const weatherComponentId = await upsertComponent(ctx, {
      userId: args.userId,
      slug: "weather-home",
      componentType: "weather",
      title: `Weather - ${weather.location.name}`,
      summary: `${weatherTemp}F ${weather.label} / wind ${weatherWind} mph`,
      data: weather,
      sourceSnapshotIds: [weatherSnapshotId],
      trustLevel: "verified",
      metadata: { provider: weather.provider, configurable: true, origin: "h.computer" },
    });
    const surfComponentId = await upsertComponent(ctx, {
      userId: args.userId,
      slug: "surf-venice-breakwater",
      componentType: "surf",
      title: "Surf - Venice Breakwater",
      summary: `${surfRange} ft @ ${surfPeriod}s / ${surf.label}`,
      data: surf,
      sourceSnapshotIds: [surfSnapshotId],
      trustLevel: "computed",
      metadata: { provider: surf.provider, configurable: true, origin: "h.computer" },
    });

    return { weatherComponentId, surfComponentId, snapshotIds: [weatherSnapshotId, surfSnapshotId] };
  },
});
