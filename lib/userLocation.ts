"use client";

import { useMemo, useSyncExternalStore } from "react";

export interface CustomerLocation {
  /** Place token (e.g. "@10.15,76.39,Kochi Airport" or slug) */
  token?: string;
  /** Place name / landmark */
  name?: string;
  /** City slug (e.g. "kochi", "bengaluru", "trivandrum") */
  citySlug?: string;
  /** Formatted city name */
  cityName?: string;
  /** State name */
  state?: string;
  /** True if explicitly set from the home search bar */
  isFromHome?: boolean;
  /** Timestamp when updated */
  timestamp?: number;
}

const STORAGE_KEY = "xotic_customer_location";
const EVENT_NAME = "xotic:location_change";

/**
 * Reads the customer's selected location from localStorage (browser-only).
 */
export function getCustomerLocation(): CustomerLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomerLocation;
  } catch {
    return null;
  }
}

/**
 * Saves or updates the customer's selected location across all pages.
 */
export function saveCustomerLocation(location: Partial<CustomerLocation>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getCustomerLocation() ?? {};
    const updated: CustomerLocation = {
      ...existing,
      ...location,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  } catch {
    // Ignore storage quota or disabled localStorage exceptions
  }
}

/**
 * Clears the stored customer location.
 */
export function clearCustomerLocation(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }));
  } catch {
    // Ignore
  }
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * React hook to reactively subscribe to customer location changes without cascading renders.
 */
export function useCustomerLocation() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const location: CustomerLocation | null = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CustomerLocation;
    } catch {
      return null;
    }
  }, [raw]);

  return {
    location,
    setLocation: saveCustomerLocation,
    clearLocation: clearCustomerLocation,
  };
}
