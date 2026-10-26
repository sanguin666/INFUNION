import { useOutletContext } from 'react-router-dom';
import type { ActiveModule } from '../api/types';

// What DashboardLayout hands every page: the place being managed, and its
// modules (null while loading), which the sidebar needs too to know which
// pages to offer.
export type DashboardContext = {
  poiId: string;
  modules: ActiveModule[] | null;
  // Settings calls this after switching a module on or off, so the
  // sidebar follows without a reload.
  refreshModules: () => void;
};

export function usePoiId(): string {
  return useOutletContext<DashboardContext>().poiId;
}

export function useRefreshModules(): () => void {
  return useOutletContext<DashboardContext>().refreshModules;
}

export function useModules(): ActiveModule[] | null {
  return useOutletContext<DashboardContext>().modules;
}
