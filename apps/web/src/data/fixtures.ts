export type KeywordRow = {
  id: string;
  keyword: string;
  rank: number | null;
  competition: number;
  opportunity: number;
  movement: number;
  tracked: boolean;
  tags: string[];
};

export const keywordRows: KeywordRow[] = [
  {
    id: "daily-journal",
    keyword: "daily journal",
    rank: 12,
    competition: 48,
    opportunity: 82,
    movement: 8,
    tracked: true,
    tags: ["core"],
  },
  {
    id: "journal-prompts",
    keyword: "journal prompts",
    rank: 18,
    competition: 38,
    opportunity: 76,
    movement: 3,
    tracked: true,
    tags: ["ideas"],
  },
  {
    id: "mood-diary",
    keyword: "mood diary",
    rank: 27,
    competition: 42,
    opportunity: 71,
    movement: 5,
    tracked: true,
    tags: ["mood"],
  },
  {
    id: "gratitude-journal",
    keyword: "gratitude journal",
    rank: 31,
    competition: 35,
    opportunity: 69,
    movement: -2,
    tracked: true,
    tags: ["core"],
  },
  {
    id: "self-care-journal",
    keyword: "self care journal",
    rank: 46,
    competition: 29,
    opportunity: 67,
    movement: 4,
    tracked: false,
    tags: [],
  },
  {
    id: "mental-health-diary",
    keyword: "mental health diary",
    rank: null,
    competition: 33,
    opportunity: 64,
    movement: 0,
    tracked: false,
    tags: [],
  },
  {
    id: "guided-journaling",
    keyword: "guided journaling",
    rank: 73,
    competition: 57,
    opportunity: 52,
    movement: -6,
    tracked: false,
    tags: [],
  },
];

export const chartSeries = [
  { name: "daily journal", color: "#0b4f2d", values: [19, 18, 17, 15, 16, 13, 12] },
  { name: "mood diary", color: "#289746", values: [34, 29, 31, 27, 25, 18, 16] },
  { name: "gratitude journal", color: "#92bf6d", values: [48, 45, 42, 38, 35, 32, 31] },
];

export const signals = [
  {
    id: "gain",
    title: "daily journal gained 8 places",
    detail: "Now #12 · strongest move this week",
    value: "+8",
    kind: "up" as const,
  },
  {
    id: "ease",
    title: "journal prompts became less crowded",
    detail: "Competition fell from 44 to 38",
    value: "−6",
    kind: "up" as const,
  },
  {
    id: "drop",
    title: "gratitude journal slipped 2 places",
    detail: "Now #31 · watch the next observation",
    value: "−2",
    kind: "down" as const,
  },
];
