import { tool } from "ai";
import { z } from "zod";
import {
  CustomerHistorySchema,
  FulfillmentDetailsSchema,
  OrderDetailsSchema,
  PaymentDetailsSchema,
  RefundHistorySchema,
  TrackingStatusSchema,
} from "@/shared/schemas";
import { fetchJson, getBaseUrl } from "./http";
import type { LedgerEntry } from "./schemas";

const OrderIdSchema = z.object({ orderId: z.string().min(1) });

type EvidenceKey =
  | "order"
  | "customer"
  | "fulfillment"
  | "tracking"
  | "refunds"
  | "payment";

export interface ToolRuntimeContext {
  orderId: string;
  evidence: Record<string, unknown>;
  ledger: LedgerEntry[];
  step: number;
  toolCache: Map<string, unknown>;
  appendLedger: (entry: Omit<LedgerEntry, "step" | "timestamp">) => void;
}

const TOOL_ROUTES: Record<
  string,
  { route: string; schema: z.ZodTypeAny; evidenceKey: EvidenceKey }
> = {
  getOrderDetails: {
    route: "getOrderDetails",
    schema: OrderDetailsSchema,
    evidenceKey: "order",
  },
  getCustomerHistory: {
    route: "getCustomerHistory",
    schema: CustomerHistorySchema,
    evidenceKey: "customer",
  },
  getFulfillmentDetails: {
    route: "getFulfillmentDetails",
    schema: FulfillmentDetailsSchema,
    evidenceKey: "fulfillment",
  },
  getTrackingStatus: {
    route: "getTrackingStatus",
    schema: TrackingStatusSchema,
    evidenceKey: "tracking",
  },
  getRefundHistory: {
    route: "getRefundHistory",
    schema: RefundHistorySchema,
    evidenceKey: "refunds",
  },
  getPaymentDetails: {
    route: "getPaymentDetails",
    schema: PaymentDetailsSchema,
    evidenceKey: "payment",
  },
};

async function callP2Tool(
  toolName: string,
  orderId: string
): Promise<Record<string, unknown>> {
  const config = TOOL_ROUTES[toolName];
  if (!config) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const result = await fetchJson(
    `${getBaseUrl()}/api/p2/tools/${config.route}`,
    {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }
  );

  if (!result.ok) {
    throw new Error(result.error);
  }

  const parsed = config.schema.safeParse(result.data);
  if (!parsed.success) {
    throw new Error(
      `P2 ${toolName} response failed validation: ${parsed.error.message}`
    );
  }

  return parsed.data as Record<string, unknown>;
}

function cacheKey(toolName: string, input: Record<string, unknown>): string {
  return `${toolName}:${JSON.stringify(input)}`;
}

function createEvidenceTool(
  toolName: string,
  description: string,
  ctx: ToolRuntimeContext
) {
  return tool({
    description,
    inputSchema: OrderIdSchema,
    execute: async ({ orderId }) => {
      const input = { orderId: orderId || ctx.orderId };
      const key = cacheKey(toolName, input);

      if (ctx.toolCache.has(key)) {
        const cached = ctx.toolCache.get(key) as Record<string, unknown>;
        ctx.appendLedger({
          toolCalled: toolName,
          toolInput: input,
          toolOutput: cached,
          reasoning: `Reused cached ${toolName} result (identical arguments).`,
        });
        return cached;
      }

      try {
        const output = await callP2Tool(toolName, input.orderId);
        const config = TOOL_ROUTES[toolName];
        ctx.evidence[config.evidenceKey] = output;
        ctx.toolCache.set(key, output);
        ctx.appendLedger({
          toolCalled: toolName,
          toolInput: input,
          toolOutput: output,
          reasoning: `Fetched ${toolName} for order ${input.orderId}.`,
        });
        return output;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Tool execution failed";
        const failureOutput = { error: message };
        ctx.appendLedger({
          toolCalled: toolName,
          toolInput: input,
          toolOutput: failureOutput,
          reasoning: `${toolName} failed: ${message}`,
        });
        return failureOutput;
      }
    },
  });
}

export function createTools(ctx: ToolRuntimeContext) {
  return {
    getOrderDetails: createEvidenceTool(
      "getOrderDetails",
      "Fetch order details including items, amount, and order date",
      ctx
    ),
    getCustomerHistory: createEvidenceTool(
      "getCustomerHistory",
      "Fetch customer purchase history and dispute count for the order's customer",
      ctx
    ),
    getFulfillmentDetails: createEvidenceTool(
      "getFulfillmentDetails",
      "Fetch fulfillment status, carrier, and shipment timestamps",
      ctx
    ),
    getTrackingStatus: createEvidenceTool(
      "getTrackingStatus",
      "Fetch carrier tracking status and delivery confirmation",
      ctx
    ),
    getRefundHistory: createEvidenceTool(
      "getRefundHistory",
      "Fetch prior refunds issued on this order",
      ctx
    ),
    getPaymentDetails: createEvidenceTool(
      "getPaymentDetails",
      "Fetch payment capture status, AVS/CVV results, and gateway details",
      ctx
    ),
  };
}

export const tools = createTools({
  orderId: "",
  evidence: {},
  ledger: [],
  step: 0,
  toolCache: new Map(),
  appendLedger: () => {},
});
