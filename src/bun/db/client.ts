import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type JsonRecord = {
  createdAt: string;
  id: string;
  key: string;
  value: string;
};

type JsonDatabase = {
  records: Array<JsonRecord>;
};

const databasePath = join(process.cwd(), "data", "app-db.json");

const emptyDatabase = (): JsonDatabase => ({ records: [] });

const readDatabase = (): JsonDatabase => {
  if (!existsSync(databasePath)) return emptyDatabase();
  const parsed = JSON.parse(readFileSync(databasePath, "utf8")) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as JsonDatabase).records)
  ) {
    return emptyDatabase();
  }
  return parsed as JsonDatabase;
};

mkdirSync(dirname(databasePath), { recursive: true });
if (!existsSync(databasePath)) {
  writeFileSync(databasePath, JSON.stringify(emptyDatabase(), null, 2));
}

export const getDatabaseStatus = () => {
  const database = readDatabase();
  return {
    driver: "json-file" as const,
    path: databasePath,
    records: database.records.length,
  };
};
