import { readFile } from "node:fs/promises";
import { normalizeCategories } from "./tournament-data.js";

const TOURNAMENTS_URL = new URL("../data/tournaments.json", import.meta.url);

let cachedRaw = "";
let cachedCategories = [];

export async function loadTournamentCategories() {
  const raw = await readFile(TOURNAMENTS_URL, "utf8");

  if (raw === cachedRaw && cachedCategories.length > 0) {
    return cachedCategories;
  }

  const parsed = JSON.parse(raw);
  const normalized = normalizeCategories(parsed);

  if (!normalized.length) {
    throw new Error("File data/tournaments.json tidak punya kategori yang valid.");
  }

  cachedRaw = raw;
  cachedCategories = normalized;
  return normalized;
}
