'use client';

import { create } from 'zustand';

type AdminShellState = {
  mobileNavigationOpen: boolean;
  openMobileNavigation: () => void;
  closeMobileNavigation: () => void;
};

export const useAdminShellStore = create<AdminShellState>((set) => ({
  mobileNavigationOpen: false,
  openMobileNavigation: () => set({ mobileNavigationOpen: true }),
  closeMobileNavigation: () => set({ mobileNavigationOpen: false })
}));
