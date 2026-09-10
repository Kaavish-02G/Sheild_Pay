import type { GatewayAdapter, GatewayType } from "@/shared/schemas";
import { mockGateway, useMockPaymentGateway } from "./mock";
import { paypalGateway } from "./paypal";
import { razorpayGateway } from "./razorpay";
import { stripeGateway } from "./stripe";

const adapters: Record<GatewayType, GatewayAdapter> = {
  stripe: stripeGateway,
  paypal: paypalGateway,
  razorpay: razorpayGateway,
};

export function getGatewayAdapter(gatewayType: GatewayType): GatewayAdapter {
  if (useMockPaymentGateway()) {
    return mockGateway;
  }
  return adapters[gatewayType];
}

export function resolveGatewayType(
  gatewayType?: GatewayType
): GatewayType {
  if (gatewayType) {
    return gatewayType;
  }
  const fallback = process.env.DEFAULT_GATEWAY_TYPE;
  if (fallback === "stripe" || fallback === "paypal" || fallback === "razorpay") {
    return fallback;
  }
  return "stripe";
}

export { stripeGateway, paypalGateway, razorpayGateway, mockGateway, useMockPaymentGateway };
