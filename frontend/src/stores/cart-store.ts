import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  productType: "physical_book" | "ebook" | "course" | "exam";
  title: string;
  title_bn: string | null;
  thumbnail_url: string | null;
  price: number;
  compare_price: number | null;
  quantity: number;
  maxQuantity: number; // stock for physical, 1 for digital
  slug: string;
  attachedTo?: string; // parent product ID (e.g. course) this exam is bundled with
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
  hasPhysicalItem: () => boolean;
  hasDigitalItem: () => boolean;
  isAllPhysical: () => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: Math.min(i.quantity + quantity, i.maxQuantity) }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...item, quantity: Math.min(quantity, item.maxQuantity) },
            ],
          };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.productId === productId
                ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity)) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      hasPhysicalItem: () =>
        get().items.some((i) => i.productType === "physical_book"),

      hasDigitalItem: () =>
        get().items.some((i) => i.productType !== "physical_book"),

      isAllPhysical: () =>
        get().items.length > 0 &&
        get().items.every((i) => i.productType === "physical_book"),
    }),
    {
      name: "lms-cart",
    }
  )
);
