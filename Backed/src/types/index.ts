// User types
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  role: 'customer' | 'admin' | 'support';
  status: 'active' | 'suspended' | 'banned';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// Product types
export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  basePrice: number;
  salePrice?: number;
  imageUrl?: string;
  status: 'draft' | 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  sku: string;
  basePrice: number;
  salePrice?: number;
  imageUrl?: string;
}

// Inventory types
export interface Inventory {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  reserved: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryWithProduct extends Inventory {
  product: Product;
}

// Order types
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  stripePaymentId?: string;
  createdAt: Date;
  confirmedAt?: Date;
}

export type OrderStatus = 
  | 'pending' 
  | 'processing' 
  | 'confirmed' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  createdAt: Date;
}

export interface CreateOrderInput {
  userId: string;
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }[];
}

// Payment types
export interface Payment {
  id: string;
  orderId: string;
  stripePaymentIntentId: string;
  amount: number;
  status: PaymentStatus;
  createdAt: Date;
  processedAt?: Date;
}

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

// Reservation types
export interface Reservation {
  orderId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  expiresAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// JWT types
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Redis key prefixes
export const REDIS_KEYS = {
  INVENTORY: (productId: string, variantId?: string) => 
    `inventory:${productId}:${variantId || 'default'}`,
  RESERVATION: (orderId: string) => `reservation:${orderId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
  RATE_LIMIT: (userId: string, endpoint: string) => `ratelimit:${userId}:${endpoint}`,
  QUEUE: (saleId: string) => `queue:${saleId}`,
} as const;
