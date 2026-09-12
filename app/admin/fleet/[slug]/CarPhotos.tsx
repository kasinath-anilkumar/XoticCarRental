"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { deleteCarPhoto, updateCarPhoto, uploadCarPhoto } from "../../actions";
import { styles } from "../../styles";

export interface CarPhoto {
  id: string;
  url: string;
  kind: string;
  alt: string | null;
  sort: number;
}

const KINDS = [
  { value: "hero", label: "Hero" },
  { value: "interior", label: "Interior" },
  { value: "rear", label: "Rear" },
  { value: "detail", label: "Detail" },
];

/**
 * The photographs for one vehicle (§18, §20).
 *
 * Four kinds, because that is what the vehicle page lays out: a hero and three
 * supporting shots. Anything beyond them still uploads and still shows in the
 * gallery strip — the page takes what it is given rather than breaking on the
 * fifth picture.
 */
export function CarPhotos({
  carId,
  slug,
  carName,
  photos,
}: {
  carId: string;
  slug: string;
  carName: string;
  photos: CarPhoto[];
}) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Photos</h2>
      <p className={styles.cardHint}>
        The hero is the picture on the fleet grid and at the top of the vehicle page. Describe each
        one — that description is what a screen reader reads out and what image search indexes.
      </p>

      <UploadForm carId={carId} slug={slug} carName={carName} count={photos.length} />

      {photos.length === 0 ? (
        <p className={styles.cardHint} style={{ marginTop: "16.8px" }}>
          No photographs yet. The site is showing a placeholder plate in their place.
        </p>
      ) : (
        <div style={{ marginTop: "16.8px" }}>
          {photos.map((photo) => (
            <PhotoRow key={photo.id} photo={photo} slug={slug} />
          ))}
        </div>
      )}
    </section>
  );
}

function UploadForm({
  carId,
  slug,
  carName,
  count,
}: {
  carId: string;
  slug: string;
  carName: string;
  count: number;
}) {
  const [state, formAction, pending] = useActionState(uploadCarPhoto, null);
  const [kind, setKind] = useState("hero");

  return (
    <form action={formAction}>
      <input type="hidden" name="car_id" value={carId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="sort" value={count} />

      {state && (
        <p className={state.ok ? styles.message : styles.messageError}>
          {state.message}
        </p>
      )}

      <div className={styles.grid3}>
        <div className="field">
          <label htmlFor="photo-file">Image file</label>
          <input
            id="photo-file"
            name="file"
            className="input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="photo-kind">Shot</label>
          <select
            id="photo-kind"
            name="kind"
            className="input"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="photo-alt">Description</label>
          <input
            id="photo-alt"
            name="alt"
            className="input"
            defaultValue={`${carName}, ${kind}`}
            key={kind}
            required
          />
        </div>
      </div>

      <div className={styles.actions}>
        <span className={styles.muted} style={{ fontSize: "12px" }}>
          JPEG, PNG, WebP or AVIF, up to 6 MB.
        </span>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Uploading…" : "Upload photo"}
        </button>
      </div>
    </form>
  );
}

function PhotoRow({ photo, slug }: { photo: CarPhoto; slug: string }) {
  const [state, formAction, pending] = useActionState(updateCarPhoto, null);
  const [removeState, removeAction, removing] = useActionState(deleteCarPhoto, null);

  return (
    <div style={{ borderTop: "1px solid var(--color-divider)", padding: "11.2px 0" }}>
      {(state ?? removeState) && (
        <p className={(state ?? removeState)?.ok ? styles.message : styles.messageError}>
          {(state ?? removeState)?.message}
        </p>
      )}

      <div className={styles.rowForm}>
        <Image
          src={photo.url}
          alt={photo.alt ?? ""}
          width={96}
          height={64}
          className="rounded-[var(--radius-sm)] object-cover"
          style={{ width: "96px", height: "64px", flex: "none" }}
          unoptimized
        />

        <form action={formAction} className={styles.rowForm} style={{ flex: 1, margin: 0 }}>
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="slug" value={slug} />

          <select
            name="kind"
            className="input"
            defaultValue={photo.kind}
            aria-label="Shot"
            style={{ maxWidth: "120px" }}
          >
            {KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            name="alt"
            className="input"
            defaultValue={photo.alt ?? ""}
            placeholder="What is in the picture"
            style={{ flex: 1, minWidth: "180px" }}
            aria-label="Description"
            required
          />

          <input
            name="sort"
            className="input"
            type="number"
            defaultValue={photo.sort}
            style={{ maxWidth: "70px" }}
            aria-label="Sort order"
          />

          <button type="submit" className="btn btn-ghost" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </form>

        <form action={removeAction} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="url" value={photo.url} />
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className="btn btn-ghost" disabled={removing}>
            {removing ? "Removing…" : "Remove"}
          </button>
        </form>
      </div>
    </div>
  );
}
