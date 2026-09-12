"use client";

import { useActionState } from "react";

import { setCarActive } from "../actions";

/**
 * Publish / hide, as a one-field form rather than a checkbox that saves on
 * change — an accidental click should not silently pull a car off the site.
 */
export function CarActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [, formAction, pending] = useActionState(setCarActive, null);

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <button
        type="submit"
        className="btn btn-ghost"
        disabled={pending}
        style={{ color: active ? "var(--color-accent-300)" : "var(--color-neutral-500)" }}
      >
        {pending ? "…" : active ? "Live" : "Hidden"}
      </button>
    </form>
  );
}
