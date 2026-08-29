/** ELCAMOSO account — links entitlements and billing; no card data stored. */
export interface User {
  id: string;
  email: string | null;
  /** Stripe Customer id when linked; null until first checkout. */
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
