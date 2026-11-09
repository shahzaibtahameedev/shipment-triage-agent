import { StateGraph, START, END } from "@langchain/langgraph";
import { NODES } from "./constants.ts";
import { TriageState } from "./state.ts";
import { routeNode, routeToCarrier } from "./route.ts";
import { dhlAgent, maerskAgent, regionalAgent } from "./carriers.ts";
import { humanApprovalNode } from "./approval.ts";
import { createCheckpointer } from "./db.ts";

export function buildWorkflow() {
  return new StateGraph(TriageState)
    .addNode(NODES.ROUTE, routeNode)
    .addNode(NODES.DHL, dhlAgent)
    .addNode(NODES.MAERSK, maerskAgent)
    .addNode(NODES.REGIONAL, regionalAgent)
    .addNode(NODES.HUMAN_APPROVAL, humanApprovalNode)
    .addEdge(START, NODES.ROUTE)
    .addConditionalEdges(NODES.ROUTE, routeToCarrier, [NODES.DHL, NODES.MAERSK, NODES.REGIONAL])
    .addEdge(NODES.DHL, NODES.HUMAN_APPROVAL)
    .addEdge(NODES.MAERSK, NODES.HUMAN_APPROVAL)
    .addEdge(NODES.REGIONAL, NODES.HUMAN_APPROVAL)
    .addEdge(NODES.HUMAN_APPROVAL, END);
}

export async function buildGraph() {
  const checkpointer = createCheckpointer();
  await checkpointer.setup();

  const graph = buildWorkflow().compile({ checkpointer });
  return { graph, checkpointer };
}
