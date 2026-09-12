"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { encodeFreePlace, type PlaceToken } from "@/lib/places";

/**
 * "Use my current location", in one place.
 *
 * Three things have to happen and any of them can fail: the browser has to give
 * up a position, the server has to put a name to it, and the result has to
 * become a place token the rest of the app already understands. Only the first
 * is allowed to stop the flow — a position with no name is still a perfectly
 * good pickup point, so a failed lookup falls back to a token labelled with its
 * own coordinates rather than an error.
 *
 * The coordinates in the token are always the browser's, never the geocoder's:
 * the visitor is standing at a gate, not at the centroid of the town, and the
 * distance we quote should be measured from where they are.
 *
 * Used by the location combobox (so every pickup and drop field has it), the
 * home page's search card, and the admin's new-pickup-point form.
 */

export interface CurrentPlace {
  token: PlaceToken;
  name: string;
  /** "Munnar, Devikulam, Kerala" — or the coordinates, if nothing is mapped. */
  detail: string;
  lat: number;
  lng: number;
}

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * The last position this browser gave us, shared across every field on the
 * page. Once a visitor has allowed it for the pickup box, the drop box can bias
 * its suggestions towards them without asking again.
 */
let lastCoords: Coords | null = null;

export function lastKnownCoords(): Coords | null {
  return lastCoords;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  // A minute-old fix is the same street. Re-using it makes a second field
  // instant instead of spinning the GPS again.
  maximumAge: 60_000,
};

function messageFor(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location is blocked for this site — search for your pickup instead.";
    case error.POSITION_UNAVAILABLE:
      return "Couldn't get a fix on your position. Try searching for it.";
    case error.TIMEOUT:
      return "That took too long. Try again, or search for your pickup.";
    default:
      return "Couldn't get your location. Search for it instead.";
  }
}

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, GEOLOCATION_OPTIONS);
  });
}

export interface UseCurrentPlace {
  /** Resolves to null when the browser would not say where it is. */
  locate: () => Promise<CurrentPlace | null>;
  locating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCurrentPlace(): UseCurrentPlace {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a state update after the field has been unmounted — the
  // whole flow can easily outlive a dropdown.
  const alive = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const locate = useCallback(async (): Promise<CurrentPlace | null> => {
    if (inFlight.current) return null;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("This browser can't share a location.");
      return null;
    }

    inFlight.current = true;
    setLocating(true);
    setError(null);

    let coords: GeolocationCoordinates;
    try {
      coords = (await position()).coords;
    } catch (failure) {
      inFlight.current = false;
      if (alive.current) {
        setError(messageFor(failure as GeolocationPositionError));
        setLocating(false);
      }
      return null;
    }
    if (!alive.current) {
      inFlight.current = false;
      return null;
    }

    const lat = coords.latitude;
    const lng = coords.longitude;
    lastCoords = { lat, lng };

    // Named if we can, coordinates if we can't. Either way it prices the same.
    let place: CurrentPlace = {
      token: encodeFreePlace({ name: "My location", lat, lng }),
      name: "My location",
      detail: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lat,
      lng,
    };

    try {
      const response = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          result?: { token: string; name: string; detail: string };
        };
        if (data.result) {
          place = { ...place, ...data.result };
        }
      }
    } catch {
      // Keep the coordinate-labelled fallback.
    }

    inFlight.current = false;
    if (alive.current) setLocating(false);
    return alive.current ? place : null;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { locate, locating, error, clearError };
}
