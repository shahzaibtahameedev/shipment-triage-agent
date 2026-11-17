import "dotenv/config";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

export const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://agent:agent@localhost:5432/agentdb";

export function createCheckpointer(): PostgresSaver {
  return PostgresSaver.fromConnString(DATABASE_URL);
}
