import { v } from "convex/values";
import { action, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
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

type SchoolEventSignal = {
  eventDate: string;
  eventTime: string | null;
  title: string;
  description: string | null;
  grade: string;
  sourceLine: string;
};

type SchoolLogisticsSignal = {
  provider: string;
  school: {
    name: string;
    sourceUrl: string;
    timezone: string;
  };
  capturedAt: string;
  activeGrades: string[];
  countdown: {
    today: string;
    lastDay: string;
    daysUntilLastDay: number | null;
    firstDay: string;
    daysUntilFirstDay: number | null;
    outForSummer: boolean;
    kids: Array<{ name: string; currentGrade: string; nextGrade: string }>;
  };
  totals: {
    fetchedEvents: number;
    upcomingEvents: number;
    holidayOrClosureCount: number;
  };
  nextEvent: SchoolEventSignal | null;
  events: SchoolEventSignal[];
  parser: {
    mode: "deterministic_google_doc";
    note: string;
  };
};

type AgendaEventSignal = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  url: string | null;
  attendeesCount: number;
  category: "family" | "sports" | "school" | "health" | "travel" | "meeting" | "personal";
  whyKept: string;
  calendarId: string | null;
};

type AgendaSignal = {
  provider: "google-calendar" | "google-calendar-unconfigured";
  capturedAt: string;
  windowStart: string;
  windowEnd: string;
  configured: boolean;
  connectionMode: "google_oauth_bearer" | "legacy_connector_gateway" | "missing";
  totals: {
    events: number;
    totalSeen: number;
    dropped: number;
    today: number;
    next7d: number;
  };
  events: AgendaEventSignal[];
  manualContext: string | null;
  parser: {
    mode: "hcomputer_importance_filter";
    note: string;
  };
};

type ProjectCatalogSignal = {
  provider: string;
  capturedAt: string;
  totals: {
    projectCount: number;
    publicCount: number;
    privateCount: number;
    commitsLast90d: number;
    stars: number;
    loc: number | null;
    lomb: number | null;
    lombToCodeRatio: number | null;
    exactMirrorProjectCount: number;
    languageMetricProjectCount: number;
    pendingMetricProjectCount: number;
  };
  definitions: {
    loc: string;
    lomb: string;
    lombToCodeRatio: string;
  };
  repoMirror: {
    repoFullName: string;
    commitSha?: string;
    fileCount: number;
    totalBytes: number;
    truncated: boolean;
    syncedAt: number;
    loc: number;
    lomb: number;
    lombToCodeRatio: number | null;
  } | null;
  projects: Array<{
    fullName: string;
    name: string;
    description: string | null;
    primaryLanguage: string | null;
    githubUrl: string;
    projectUrl: string | null;
    pushedAt: number;
    commitsLast90d: number;
    stars: number;
    isPrivate: boolean;
    visibility: "private" | "public";
    insight: string | null;
    loc: number | null;
    lomb: number | null;
    lombToCodeRatio: number | null;
    languages: Record<string, number> | null;
    metricStatus: "estimated_github_languages" | "exact_repo_mirror" | "pending_github_languages_adapter";
  }>;
};

type ProjectLanguageMetric = {
  fullName: string;
  languages: Record<string, number>;
  loc: number;
  lomb: number;
  lombToCodeRatio: number | null;
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

const DEFAULT_SCHOOL_DOC_URL =
  "https://docs.google.com/document/d/12e-X5WOsKPalpYth2juWhJUVRRaCcKeDP6GE9pSM8JY/mobilebasic";
const SCHOOL_NAME = "Mar Vista Elementary";
const SCHOOL_LAST_DAY = "2026-06-12";
const SCHOOL_FIRST_DAY = "2026-08-13";
const SCHOOL_KIDS = [
  { name: "West", currentGrade: "1st", nextGrade: "2nd" },
  { name: "Willa", currentGrade: "tk-prep", nextGrade: "TK" },
];
const HOLIDAY_OR_CLOSURE_RE = /\b(no school|holiday|break|recess|day off|closed|memorial|labor|thanksgiving|veterans|presidents|mlk|cesar chavez|winter|spring|summer)\b/i;
const SCHOOL_KEEP_RE = /\b(no school|holiday|break|recess|day off|closed|conference|picture|back.to.school|pta|fundraiser|gala|auction|book fair|jog.?a.?thon|movie|game night|spirit|dress|field trip|performance|assembly|award|volunteer|first day|last day|orientation|meeting|open house|minimum day|early dismissal)\b/i;
const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function activeSchoolGrades(now = new Date()): string[] {
  const switchDate = new Date("2026-08-01T00:00:00Z");
  return now < switchDate ? ["1st", "all"] : ["TK", "2nd", "all"];
}

function stripSchoolDocHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchSchoolDoc(): Promise<{ sourceUrl: string; text: string }> {
  const sourceUrl = process.env.YOUMD_SCHOOL_DOC_URL || DEFAULT_SCHOOL_DOC_URL;
  const res = await fetch(sourceUrl, {
    headers: { "User-Agent": "You.md school-logistics DSI crawler" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`school doc fetch failed: ${res.status}`);
  const html = await res.text();
  return { sourceUrl, text: stripSchoolDocHtml(html).slice(0, 80_000) };
}

function inferSchoolEventDate(line: string, now = new Date()): string | null {
  const todayIso = now.toISOString().slice(0, 10);
  const iso = line.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = line.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    let year = slash[3] ? Number(slash[3]) : now.getUTCFullYear();
    if (year < 100) year += 2000;
    if (!slash[3]) {
      const tentative = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (daysBetweenIso(todayIso, tentative) < -45) year += 1;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const monthName = line.match(/\b(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sept|Sep|October|Oct|November|Nov|December|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?\b/i);
  if (!monthName) return null;
  const month = MONTHS[monthName[1].toLowerCase().replace(/\.$/, "")];
  const day = Number(monthName[2]);
  let year = monthName[3] ? Number(monthName[3]) : now.getUTCFullYear();
  if (!monthName[3]) {
    const tentative = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (daysBetweenIso(todayIso, tentative) < -45) year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferSchoolEventTime(line: string): string | null {
  const match = line.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)\b/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const suffix = match[3].toUpperCase();
  return `${hour}:${minute} ${suffix}`;
}

function inferSchoolGrade(line: string, activeGrades: string[]): string | null {
  const lower = line.toLowerCase();
  if (/\btk\b|transitional kindergarten/.test(lower)) return activeGrades.includes("TK") ? "TK" : null;
  if (/\b2nd\b|second grade/.test(lower)) return activeGrades.includes("2nd") ? "2nd" : null;
  if (/\b1st\b|first grade/.test(lower)) return activeGrades.includes("1st") ? "1st" : null;
  if (/\bkinder|kindergarten|3rd|third grade|4th|fourth grade|5th|fifth grade\b/.test(lower)) return null;
  return "all";
}

function cleanSchoolTitle(line: string): string {
  return line
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, "")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, "")
    .replace(/\b(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sept|Sep|October|Oct|November|Nov|December|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*20\d{2})?\b/gi, "")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(AM|PM|am|pm)\b/g, "")
    .replace(/^[\s:;,\-–—|]+|[\s:;,\-–—|]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

function parseSchoolEvents(docText: string, activeGrades: string[], now = new Date()): SchoolEventSignal[] {
  const todayIso = now.toISOString().slice(0, 10);
  const seen = new Set<string>();
  const events: SchoolEventSignal[] = [];
  for (const rawLine of docText.split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line.length < 8 || line.length > 350) continue;
    const eventDate = inferSchoolEventDate(line, now);
    if (!eventDate) continue;
    if (daysBetweenIso(todayIso, eventDate) < -7) continue;
    const grade = inferSchoolGrade(line, activeGrades);
    if (!grade) continue;
    if (grade === "all" && !SCHOOL_KEEP_RE.test(line)) continue;
    const title = cleanSchoolTitle(line) || "School event";
    const key = `${eventDate}:${grade}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      eventDate,
      eventTime: inferSchoolEventTime(line),
      title,
      description: line.length > title.length ? line : null,
      grade,
      sourceLine: line,
    });
  }
  return events.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.title.localeCompare(b.title)).slice(0, 80);
}

function buildSchoolLogisticsSignal(args: {
  sourceUrl: string;
  docText: string;
  now?: Date;
}): SchoolLogisticsSignal {
  const now = args.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const activeGrades = activeSchoolGrades(now);
  const events = parseSchoolEvents(args.docText, activeGrades, now);
  const upcomingEvents = events.filter((event) => daysBetweenIso(today, event.eventDate) >= 0);
  const daysUntilLastDay = daysBetweenIso(today, SCHOOL_LAST_DAY);
  const daysUntilFirstDay = daysBetweenIso(today, SCHOOL_FIRST_DAY);
  return {
    provider: "google-doc-mobilebasic",
    school: {
      name: SCHOOL_NAME,
      sourceUrl: args.sourceUrl,
      timezone: "America/Los_Angeles",
    },
    capturedAt: now.toISOString(),
    activeGrades,
    countdown: {
      today,
      lastDay: SCHOOL_LAST_DAY,
      daysUntilLastDay: daysUntilLastDay >= 0 ? daysUntilLastDay : null,
      firstDay: SCHOOL_FIRST_DAY,
      daysUntilFirstDay: daysUntilFirstDay >= 0 ? daysUntilFirstDay : null,
      outForSummer: daysUntilLastDay < 0 && daysUntilFirstDay > 0,
      kids: SCHOOL_KIDS,
    },
    totals: {
      fetchedEvents: events.length,
      upcomingEvents: upcomingEvents.length,
      holidayOrClosureCount: events.filter((event) => HOLIDAY_OR_CLOSURE_RE.test(event.title) || HOLIDAY_OR_CLOSURE_RE.test(event.description ?? "")).length,
    },
    nextEvent: upcomingEvents[0] ?? null,
    events,
    parser: {
      mode: "deterministic_google_doc",
      note: "First You.md-native school DSI crawler ported from h.computer; LLM extraction and Google Calendar writeback remain adapter follow-ups.",
    },
  };
}

type RawCalendarAttendee = { email?: string; displayName?: string; self?: boolean; responseStatus?: string };
type RawCalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: RawCalendarAttendee[];
  transparency?: string;
  recurringEventId?: string;
};

type CalendarAuthConfig = {
  baseUrl: string;
  headers: Record<string, string>;
  mode: AgendaSignal["connectionMode"];
};

const CAL_FAMILY_RE = /\b(family|wife|husband|kid|kids|son|daughter|mom|dad|parent|babysitter|nanny|birthday|anniversary|dinner w\/|dinner with)\b/i;
const CAL_SPORTS_RE = /\b(practice|game|match|tournament|coach|soccer|baseball|basketball|football|surf lesson|jiu jitsu|bjj|tennis|swim|gym class|yoga class|pilates)\b/i;
const CAL_SCHOOL_RE = /\b(school|teacher|conference|pickup|drop[- ]off|recital|play|concert|field trip|orientation|pta)\b/i;
const CAL_HEALTH_RE = /\b(doctor|dr\.|dentist|orthodontist|therapy|physical|checkup|appointment|pediatrician|vet)\b/i;
const CAL_TRAVEL_RE = /\b(flight|airport|hotel|trip|vacation|departure|arrival|train|uber to|drive to)\b/i;
const CAL_FLUFF_TITLE_RE = /^\s*(\[?fluff\]?|focus|deep work|no meetings?|hold|tentative|busy|block|buffer|prep|lunch|commute|drive|out of office|ooo|wfh|workout)\b/i;
const CAL_FLUFF_TAG_RE = /\[fluff\]/i;

function calendarAuthConfig(): CalendarAuthConfig | null {
  const bearer = process.env.YOUMD_GOOGLE_CALENDAR_ACCESS_TOKEN;
  if (bearer) {
    return {
      baseUrl: "https://www.googleapis.com/calendar/v3",
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json",
      },
      mode: "google_oauth_bearer",
    };
  }
  const lovable = process.env.LOVABLE_API_KEY;
  const connection = process.env.YOUMD_GOOGLE_CALENDAR_API_KEY || process.env.GOOGLE_CALENDAR_API_KEY;
  if (lovable && connection) {
    return {
      baseUrl: "https://connector-gateway.lovable.dev/google_calendar/calendar/v3",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": connection,
        Accept: "application/json",
      },
      mode: "legacy_connector_gateway",
    };
  }
  return null;
}

async function calendarGet<T>(config: CalendarAuthConfig, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${config.baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString(), {
    headers: config.headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`calendar ${path} ${res.status}: ${body.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

async function listCalendarIds(config: CalendarAuthConfig): Promise<string[]> {
  try {
    const data = await calendarGet<{ items?: Array<{ id?: string; hidden?: boolean }> }>(
      config,
      "/users/me/calendarList",
      { minAccessRole: "reader", showHidden: "false" }
    );
    const ids = (data.items ?? [])
      .filter((calendar) => calendar.id && calendar.hidden !== true)
      .map((calendar) => calendar.id as string);
    return ids.length ? ids : ["primary"];
  } catch {
    return ["primary"];
  }
}

function categorizeCalendarEvent(event: RawCalendarEvent): { keep: boolean; category: AgendaEventSignal["category"]; why: string } {
  const title = event.summary ?? "";
  const description = event.description ?? "";
  const haystack = `${title}\n${description}`;
  if (CAL_FAMILY_RE.test(haystack)) return { keep: true, category: "family", why: "family" };
  if (CAL_SPORTS_RE.test(haystack)) return { keep: true, category: "sports", why: "sports/practice" };
  if (CAL_SCHOOL_RE.test(haystack)) return { keep: true, category: "school", why: "school" };
  if (CAL_HEALTH_RE.test(haystack)) return { keep: true, category: "health", why: "appointment" };
  if (CAL_TRAVEL_RE.test(haystack)) return { keep: true, category: "travel", why: "travel" };
  if (CAL_FLUFF_TAG_RE.test(haystack)) return { keep: false, category: "personal", why: "tagged fluff" };
  if ((event.attendees ?? []).find((attendee) => attendee.self)?.responseStatus === "declined") {
    return { keep: false, category: "meeting", why: "declined" };
  }
  if (event.status === "cancelled") return { keep: false, category: "meeting", why: "cancelled" };
  if (event.transparency === "transparent") return { keep: false, category: "personal", why: "free/hold" };
  if (CAL_FLUFF_TITLE_RE.test(title)) return { keep: false, category: "personal", why: "fluff title" };
  const allDay = !!event.start?.date;
  const attendees = (event.attendees ?? []).filter((attendee) => !attendee.self);
  if (allDay && attendees.length === 0) return { keep: false, category: "personal", why: "all-day hold" };
  if (attendees.length >= 25 && event.recurringEventId) return { keep: false, category: "meeting", why: "mega all-hands" };
  if (attendees.length > 0) return { keep: true, category: "meeting", why: "meeting w/ attendees" };
  return { keep: false, category: "personal", why: "solo block" };
}

function agendaEventFromRaw(event: RawCalendarEvent, category: ReturnType<typeof categorizeCalendarEvent>, calendarId: string | null): AgendaEventSignal {
  const attendees = (event.attendees ?? []).filter((attendee) => !attendee.self);
  return {
    id: event.id ?? `${event.start?.dateTime ?? event.start?.date ?? "event"}:${event.summary ?? "untitled"}`,
    title: (event.summary ?? "(no title)").trim(),
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    allDay: !!event.start?.date,
    location: event.location ?? null,
    url: event.htmlLink ?? null,
    attendeesCount: attendees.length,
    category: category.category,
    whyKept: category.why,
    calendarId,
  };
}

async function fetchCalendarEvents(config: CalendarAuthConfig, windowStart: string, windowEnd: string): Promise<{ events: AgendaEventSignal[]; dropped: number; totalSeen: number }> {
  const calendarIds = await listCalendarIds(config);
  const results = await Promise.all(
    calendarIds.map((calendarId) =>
      calendarGet<{ items?: RawCalendarEvent[] }>(
        config,
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          timeMin: windowStart,
          timeMax: windowEnd,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "100",
        }
      )
        .then((data) => ({ calendarId, items: data.items ?? [] }))
        .catch(() => ({ calendarId, items: [] as RawCalendarEvent[] }))
    )
  );
  const seen = new Set<string>();
  const events: AgendaEventSignal[] = [];
  let dropped = 0;
  let totalSeen = 0;
  for (const result of results) {
    for (const item of result.items) {
      totalSeen += 1;
      const key = item.id ?? `${item.start?.dateTime ?? item.start?.date}:${item.summary}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const category = categorizeCalendarEvent(item);
      if (!category.keep) {
        dropped += 1;
        continue;
      }
      events.push(agendaEventFromRaw(item, category, result.calendarId));
    }
  }
  events.sort((a, b) => a.start.localeCompare(b.start));
  return { events, dropped, totalSeen };
}

async function fetchAgendaSignal(daysAhead = 7): Promise<AgendaSignal> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getTime() + daysAhead * 86_400_000);
  const config = calendarAuthConfig();
  if (!config) {
    return {
      provider: "google-calendar-unconfigured",
      capturedAt: now.toISOString(),
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      configured: false,
      connectionMode: "missing",
      totals: { events: 0, totalSeen: 0, dropped: 0, today: 0, next7d: 0 },
      events: [],
      manualContext: null,
      parser: {
        mode: "hcomputer_importance_filter",
        note: "Google Calendar connector is not configured in this environment yet. The DSI component preserves the access boundary instead of inventing agenda data.",
      },
    };
  }
  const fetched = await fetchCalendarEvents(config, start.toISOString(), end.toISOString());
  const todayKey = now.toISOString().slice(0, 10);
  return {
    provider: "google-calendar",
    capturedAt: now.toISOString(),
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    configured: true,
    connectionMode: config.mode,
    totals: {
      events: fetched.events.length,
      totalSeen: fetched.totalSeen,
      dropped: fetched.dropped,
      today: fetched.events.filter((event) => event.start.slice(0, 10) === todayKey).length,
      next7d: fetched.events.length,
    },
    events: fetched.events,
    manualContext: null,
    parser: {
      mode: "hcomputer_importance_filter",
      note: "Ported from h.computer's important-upcoming Google Calendar filter: keep family, sports, school, health, travel, and meetings with attendees; drop common focus/hold/fluff blocks.",
    },
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

function lineCount(content: string): number {
  if (!content) return 0;
  return content.split(/\r\n|\r|\n/).length;
}

function isMarkdownPath(path: string): boolean {
  return /\.(md|mdx)$/i.test(path);
}

function lombRatio(loc: number | null, lomb: number | null): number | null {
  if (loc === null || lomb === null) return null;
  const code = loc - lomb;
  if (code <= 0) return null;
  return Math.round((lomb / code) * 1000) / 1000;
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

function projectUrlFromBundle(projects: Array<Record<string, unknown>>, tracked: Doc<"trackedProjects">): string | null {
  const normalizedName = tracked.name.toLowerCase();
  const normalizedFullName = tracked.fullName.toLowerCase();
  const match = projects.find((project) => {
    const name = typeof project.name === "string" ? project.name.toLowerCase() : "";
    const title = typeof project.title === "string" ? project.title.toLowerCase() : "";
    const url = typeof project.url === "string" ? project.url.toLowerCase() : "";
    const github = typeof project.github === "string" ? project.github.toLowerCase() : "";
    const githubUrl = typeof project.githubUrl === "string" ? project.githubUrl.toLowerCase() : "";
    return (
      name === normalizedName ||
      title === normalizedName ||
      url.includes(normalizedName) ||
      github.includes(normalizedFullName) ||
      githubUrl.includes(normalizedFullName)
    );
  });
  if (!match) return null;
  for (const key of ["url", "website", "href", "demoUrl", "demo"]) {
    const value = match[key];
    if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  }
  return null;
}

function mirrorLineStats(repoMirror: Doc<"repoMirror"> | null): { loc: number; lomb: number; ratio: number | null } | null {
  if (!repoMirror) return null;
  let loc = 0;
  let lomb = 0;
  for (const file of repoMirror.files) {
    const lines = lineCount(file.content);
    loc += lines;
    if (isMarkdownPath(file.path)) lomb += lines;
  }
  return { loc, lomb, ratio: lombRatio(loc, lomb) };
}

function buildProjectCatalogSignal(args: {
  trackedProjects: Doc<"trackedProjects">[];
  latestBundle: Doc<"bundles"> | null;
  repoMirror: Doc<"repoMirror"> | null;
  languageMetrics?: ProjectLanguageMetric[];
}): ProjectCatalogSignal {
  const youJson = (args.latestBundle?.youJson ?? {}) as Record<string, unknown>;
  const bundleProjects = Array.isArray(youJson.projects) ? (youJson.projects as Array<Record<string, unknown>>) : [];
  const mirrorStats = mirrorLineStats(args.repoMirror);
  const languageMetricsByRepo = new Map((args.languageMetrics ?? []).map((metric) => [metric.fullName, metric]));
  const projects = args.trackedProjects
    .slice()
    .sort((a, b) => b.pushedAt - a.pushedAt)
    .map((project) => {
      const languageMetric = languageMetricsByRepo.get(project.fullName);
      const isMirror = args.repoMirror?.repoFullName === project.fullName && mirrorStats !== null;
      const loc = languageMetric?.loc ?? (isMirror ? mirrorStats.loc : null);
      const lomb = languageMetric?.lomb ?? (isMirror ? mirrorStats.lomb : null);
      return {
        fullName: project.fullName,
        name: project.name,
        description: project.description ?? null,
        primaryLanguage: project.primaryLanguage ?? null,
        githubUrl: `https://github.com/${project.fullName}`,
        projectUrl: projectUrlFromBundle(bundleProjects, project),
        pushedAt: project.pushedAt,
        commitsLast90d: project.commitsLast90d,
        stars: project.stars ?? 0,
        isPrivate: project.isPrivate,
        visibility: project.visibility,
        insight: project.insight ?? null,
        loc,
        lomb,
        lombToCodeRatio: lombRatio(loc, lomb),
        languages: languageMetric?.languages ?? null,
        metricStatus: languageMetric ? "estimated_github_languages" as const : isMirror ? "exact_repo_mirror" as const : "pending_github_languages_adapter" as const,
      };
    });
  const totals = projects.reduce(
    (acc, project) => {
      acc.commitsLast90d += project.commitsLast90d;
      acc.stars += project.stars;
      if (project.visibility === "public") acc.publicCount += 1;
      else acc.privateCount += 1;
      if (project.loc !== null) {
        acc.loc += project.loc;
        acc.lomb += project.lomb ?? 0;
        if (project.metricStatus === "estimated_github_languages") acc.languageMetricProjectCount += 1;
        if (project.metricStatus === "exact_repo_mirror") acc.exactMirrorProjectCount += 1;
      } else {
        acc.pendingMetricProjectCount += 1;
      }
      return acc;
    },
    {
      publicCount: 0,
      privateCount: 0,
      commitsLast90d: 0,
      stars: 0,
      loc: 0,
      lomb: 0,
      exactMirrorProjectCount: 0,
      languageMetricProjectCount: 0,
      pendingMetricProjectCount: 0,
    }
  );
  const hasLoc = totals.exactMirrorProjectCount + totals.languageMetricProjectCount > 0;
  return {
    provider: "youmd-github-tracked-projects",
    capturedAt: new Date().toISOString(),
    totals: {
      projectCount: projects.length,
      publicCount: totals.publicCount,
      privateCount: totals.privateCount,
      commitsLast90d: totals.commitsLast90d,
      stars: totals.stars,
      loc: hasLoc ? totals.loc : null,
      lomb: hasLoc ? totals.lomb : null,
      lombToCodeRatio: hasLoc ? lombRatio(totals.loc, totals.lomb) : null,
      exactMirrorProjectCount: totals.exactMirrorProjectCount,
      languageMetricProjectCount: totals.languageMetricProjectCount,
      pendingMetricProjectCount: totals.pendingMetricProjectCount,
    },
    definitions: {
      loc: "LOC is the all-in line estimate from GitHub language byte totals, with exact repo-mirror line counts when language metrics are unavailable.",
      lomb: "LOMB is Lines Of Markdown / Bytes: markdown-only lines as Houston's english-as-code metric. GitHub language metrics estimate Markdown/MDX lines from byte totals.",
      lombToCodeRatio: "LOMB / (LOC - LOMB), comparing markdown directly to non-markdown code.",
    },
    repoMirror: args.repoMirror && mirrorStats
      ? {
          repoFullName: args.repoMirror.repoFullName,
          commitSha: args.repoMirror.commitSha,
          fileCount: args.repoMirror.fileCount,
          totalBytes: args.repoMirror.totalBytes,
          truncated: args.repoMirror.truncated,
          syncedAt: args.repoMirror.syncedAt,
          loc: mirrorStats.loc,
          lomb: mirrorStats.lomb,
          lombToCodeRatio: mirrorStats.ratio,
        }
      : null,
    projects,
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

export const refreshSchoolLogistics = action({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ componentId: Id<"dsiComponents">; snapshotId: Id<"sourceSnapshots">; eventCount: number }> => {
    await requireOwner(ctx, args.clerkId);
    const doc = await fetchSchoolDoc();
    const school = buildSchoolLogisticsSignal({
      sourceUrl: doc.sourceUrl,
      docText: doc.text,
    });
    const result = await ctx.runMutation(internal.dsi.persistSchoolLogisticsComponent, {
      clerkId: args.clerkId,
      userId: args.userId,
      school,
    });
    return { ...result, eventCount: school.totals.upcomingEvents };
  },
});

export const refreshAgenda = action({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ componentId: Id<"dsiComponents">; snapshotId: Id<"sourceSnapshots">; eventCount: number; configured: boolean }> => {
    await requireOwner(ctx, args.clerkId);
    const agenda = await fetchAgendaSignal(Math.min(Math.max(args.daysAhead ?? 7, 1), 30));
    const result = await ctx.runMutation(internal.dsi.persistAgendaComponent, {
      clerkId: args.clerkId,
      userId: args.userId,
      agenda,
    });
    return {
      ...result,
      eventCount: agenda.totals.events,
      configured: agenda.configured,
    };
  },
});

async function persistProjectCatalog(
  ctx: MutationCtx,
  args: {
    clerkId: string;
    userId: Id<"users">;
    languageMetrics?: ProjectLanguageMetric[];
  }
): Promise<{ componentId: Id<"dsiComponents">; snapshotId: Id<"sourceSnapshots"> }> {
  await ownerForUserId(ctx, args.clerkId, args.userId);
  const [trackedProjects, latestBundle, repoMirror] = await Promise.all([
    ctx.db
      .query("trackedProjects")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect(),
    ctx.db
      .query("bundles")
      .withIndex("by_userId_version", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first(),
    ctx.db
      .query("repoMirror")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first(),
  ]);
  const catalog = buildProjectCatalogSignal({
    trackedProjects,
    latestBundle,
    repoMirror,
    languageMetrics: args.languageMetrics,
  });
  const snapshotId = await insertSnapshot(ctx, {
    userId: args.userId,
    connectorKind: "github",
    sourceKey: "github-project-catalog",
    sourceType: "dsi_component",
    normalized: catalog,
    citations: catalog.projects.map((project) => ({
      provider: "github",
      url: project.githubUrl,
    })),
    visibility: "private",
    trustLevel: catalog.projects.length ? "verified" : "low",
    metadata: {
      adapter: args.languageMetrics?.length ? "github-languages-plus-tracked-projects" : "tracked-projects-plus-repo-mirror",
      locMetricStatus: args.languageMetrics?.length
        ? "GitHub languages estimate all fetched tracked repos; repoMirror exact stats retained"
        : "repoMirror exact, non-mirror repos pending GitHub languages adapter",
    },
  });
  const summary = [
    `${catalog.totals.projectCount} projects`,
    `${catalog.totals.commitsLast90d} commits/90d`,
    catalog.totals.loc === null ? "LOC pending" : `${catalog.totals.loc.toLocaleString()} LOC`,
    catalog.totals.lomb === null ? "LOMB pending" : `${catalog.totals.lomb.toLocaleString()} LOMB`,
  ].join(" / ");
  const componentId = await upsertComponent(ctx, {
    userId: args.userId,
    slug: "github-project-catalog",
    componentType: "github_projects",
    title: "GitHub Project Catalog",
    summary,
    data: catalog,
    sourceSnapshotIds: [snapshotId],
    trustLevel: catalog.projects.length ? "verified" : "low",
    metadata: { provider: catalog.provider, configurable: true, origin: "youmd" },
  });
  return { componentId, snapshotId };
}

export const refreshProjectCatalog = mutation({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ componentId: Id<"dsiComponents">; snapshotId: Id<"sourceSnapshots"> }> => {
    return await persistProjectCatalog(ctx, args);
  },
});

export const persistProjectCatalogWithLanguageMetrics = internalMutation({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
    languageMetrics: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args): Promise<{ componentId: Id<"dsiComponents">; snapshotId: Id<"sourceSnapshots"> }> => {
    return await persistProjectCatalog(ctx, {
      clerkId: args.clerkId,
      userId: args.userId,
      languageMetrics: args.languageMetrics as ProjectLanguageMetric[] | undefined,
    });
  },
});

export const persistAgendaComponent = internalMutation({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
    agenda: v.any(),
  },
  handler: async (ctx, args): Promise<{ componentId: Id<"dsiComponents">; snapshotId: Id<"sourceSnapshots"> }> => {
    await ownerForUserId(ctx, args.clerkId, args.userId);
    const agenda = args.agenda as AgendaSignal;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.userId))
      .first();
    const privateContext = profile
      ? await ctx.db
          .query("privateContext")
          .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
          .first()
      : null;
    const withManualContext: AgendaSignal = {
      ...agenda,
      manualContext: privateContext?.calendarContext ?? agenda.manualContext,
    };
    const snapshotId = await insertSnapshot(ctx, {
      userId: args.userId,
      connectorKind: "google-calendar",
      sourceKey: "agenda-today",
      sourceType: "dsi_component",
      normalized: withManualContext,
      citations: [{ provider: withManualContext.provider, url: "https://calendar.google.com/calendar" }],
      visibility: "private",
      trustLevel: withManualContext.configured ? "verified" : "low",
      metadata: {
        origin: "h.computer",
        adapter: "google-calendar-important-agenda",
        connectionMode: withManualContext.connectionMode,
      },
    });
    const manual = withManualContext.manualContext ? "manual context" : "no manual context";
    const summary = withManualContext.configured
      ? `${withManualContext.totals.events} kept / ${withManualContext.totals.dropped} dropped / ${withManualContext.totals.today} today / ${manual}`
      : `calendar connector missing / ${manual}`;
    const componentId = await upsertComponent(ctx, {
      userId: args.userId,
      slug: "agenda-today",
      componentType: "agenda",
      title: "Agenda - Google Calendar",
      summary,
      data: withManualContext,
      sourceSnapshotIds: [snapshotId],
      trustLevel: withManualContext.configured ? "verified" : "low",
      metadata: { provider: withManualContext.provider, configurable: true, origin: "h.computer" },
    });
    return { componentId, snapshotId };
  },
});

export const persistSchoolLogisticsComponent = internalMutation({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
    school: v.any(),
  },
  handler: async (ctx, args): Promise<{ componentId: Id<"dsiComponents">; snapshotId: Id<"sourceSnapshots"> }> => {
    await ownerForUserId(ctx, args.clerkId, args.userId);
    const school = args.school as SchoolLogisticsSignal;
    const snapshotId = await insertSnapshot(ctx, {
      userId: args.userId,
      connectorKind: "school",
      sourceKey: "school-logistics",
      sourceType: "dsi_component",
      normalized: school,
      citations: [{ provider: school.provider, url: school.school.sourceUrl }],
      visibility: "private",
      trustLevel: "computed",
      metadata: {
        origin: "h.computer",
        adapter: "google-doc-school-logistics",
        parser: school.parser.mode,
      },
    });
    const next = school.nextEvent
      ? `${school.nextEvent.title} ${school.nextEvent.eventDate}`
      : "no upcoming school events parsed";
    const countdown = school.countdown.outForSummer && school.countdown.daysUntilFirstDay !== null
      ? `${school.countdown.daysUntilFirstDay}d until fall`
      : school.countdown.daysUntilLastDay !== null
        ? `${school.countdown.daysUntilLastDay}d until summer`
        : "school countdown ready";
    const componentId = await upsertComponent(ctx, {
      userId: args.userId,
      slug: "school-logistics",
      componentType: "school",
      title: `School - ${school.school.name}`,
      summary: `${school.totals.upcomingEvents} upcoming / ${countdown} / ${next}`,
      data: school,
      sourceSnapshotIds: [snapshotId],
      trustLevel: "computed",
      metadata: { provider: school.provider, configurable: true, origin: "h.computer" },
    });
    return { componentId, snapshotId };
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
