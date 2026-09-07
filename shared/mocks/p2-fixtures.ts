import type {

  CustomerHistory,

  FulfillmentDetails,

  OrderDetails,

  PaymentDetails,

  RefundHistory,

  TrackingStatus,

} from "@/shared/schemas";

import {

  mockOrderTotal,

  mockPaymentId,

  mockTrackingNumber,

} from "./order-variation";



export const MOCK_ORDER_ID = "1042";



export function mockOrderDetails(orderId: string): OrderDetails {

  const totalAmount = mockOrderTotal(orderId);

  const itemPrice = Math.round((totalAmount / 2) * 100) / 100;



  return {

    orderId,

    customerId: `cust-${orderId}`,

    items: [

      { name: "Wireless Headphones", quantity: 1, price: itemPrice },

      { name: "USB-C Cable", quantity: 1, price: Math.round((totalAmount - itemPrice) * 100) / 100 },

    ],

    totalAmount,

    currency: "USD",

    createdAt: "2026-08-28T14:22:00.000Z",

  };

}



export function mockCustomerHistory(customerId: string): CustomerHistory {

  const orderId = customerId.replace(/^cust-/, "") || MOCK_ORDER_ID;

  const totalAmount = mockOrderTotal(orderId);



  return {

    customerId,

    email: "customer@example.com",

    totalOrders: 3,

    accountCreatedAt: "2025-11-15T09:00:00.000Z",

    recentOrders: [

      {

        orderId,

        totalAmount,

        currency: "USD",

        createdAt: "2026-08-28T14:22:00.000Z",

        status: "completed",

      },

      {

        orderId: "981",

        totalAmount: mockOrderTotal("981"),

        currency: "USD",

        createdAt: "2026-07-10T11:05:00.000Z",

        status: "completed",

      },

      {

        orderId: "812",

        totalAmount: mockOrderTotal("812"),

        currency: "USD",

        createdAt: "2026-05-02T16:40:00.000Z",

        status: "completed",

      },

    ],

    disputeCount: 0,

  };

}



export function mockFulfillmentDetails(orderId: string): FulfillmentDetails {

  const trackingNumber = mockTrackingNumber(orderId);



  return {

    orderId,

    status: "fulfilled",

    trackingNumber,

    carrier: "UPS",

    shippedAt: "2026-08-29T10:15:00.000Z",

    deliveredAt: "2026-09-01T14:14:00.000Z",

  };

}



export function mockTrackingStatus(orderId: string): TrackingStatus {

  const trackingNumber = mockTrackingNumber(orderId);



  return {

    orderId,

    carrier: "UPS",

    trackingNumber,

    status: "delivered",

    lastUpdate: "2026-09-01T14:14:00.000Z",

    deliveredAt: "2026-09-01T14:14:00.000Z",

    events: [

      {

        timestamp: "2026-08-29T10:15:00.000Z",

        description: "Shipment picked up",

        location: "San Francisco, CA",

      },

      {

        timestamp: "2026-08-31T08:22:00.000Z",

        description: "In transit",

        location: "Sacramento, CA",

      },

      {

        timestamp: "2026-09-01T14:14:00.000Z",

        description: "Delivered to front door",

        location: "Oakland, CA",

      },

    ],

  };

}



export function mockRefundHistory(orderId: string): RefundHistory {

  return {

    orderId,

    refunds: [],

    totalRefunded: 0,

  };

}



export function mockPaymentDetails(orderId: string): PaymentDetails {

  const totalAmount = mockOrderTotal(orderId);



  return {

    orderId,

    paymentId: mockPaymentId(orderId),

    status: "captured",

    amount: totalAmount,

    currency: "USD",

    method: "card",

    avsResult: "match",

    cvvResult: "match",

    gateway: "stripe",
    cardNetwork: "visa",
    capturedAt: "2026-08-28T14:22:05.000Z",

  };

}


