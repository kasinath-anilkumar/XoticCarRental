import Link from "next/link";
import type { ReactNode } from "react";
import { Media } from "@/components/ui/Media";
import { Icon } from "@/components/ui/Icon";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import styles from "./Editorial.module.css";

export { default as editorial } from "./Editorial.module.css";

export function EditorialIntro({ eyebrow, title, description, mobileTitle, mobileDescription, image, imageLabel, actions, breadcrumb, breadcrumbCurrent }: {
  eyebrow: string; title: string; description: string; image?: string | null; imageLabel?: string;
  mobileTitle?: string; mobileDescription?: string;
  actions?: ReactNode; breadcrumb?: { label: string; href: string }[]; breadcrumbCurrent?: string;
}) {
  const preview = mobileDescription ?? (description.length > 165 ? `${description.slice(0, 145).replace(/\s+\S*$/, "")}…` : description);
  const hasPreview = preview !== description;
  return <section className={`${styles.intro} ${image === undefined ? styles.textIntro : ""}`}>
    <div className={styles.introText}>
      {breadcrumb && <nav className={styles.breadcrumbs} aria-label="Breadcrumb">{breadcrumb.map((item) => <span key={item.href}><Link href={item.href}>{item.label}</Link><span aria-hidden="true"> / </span></span>)}<span aria-current="page">{breadcrumbCurrent ?? eyebrow}</span></nav>}
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{mobileTitle ? <><span className={styles.desktopCopy}>{title}</span><span className={styles.mobileCopy}>{mobileTitle}</span></> : title}</h1>
      <p className={`${styles.description} ${hasPreview ? styles.desktopCopy : ""}`}>{description}</p>
      {hasPreview && <div className={styles.mobileCopy}><p className={styles.description}>{preview}</p><ResponsiveDisclosure title="Read more" className={styles.introMore} headingLevel={3}><p className={styles.description}>{description}</p></ResponsiveDisclosure></div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
    {image !== undefined && <div className={styles.visual}>
      <Media src={image} alt="" placeholder={imageLabel ?? eyebrow} icon="ph-car-simple" priority sizes="(max-width: 700px) 100vw, 48vw" className="absolute inset-0" />
      {imageLabel && <span className={styles.imageNote}><Icon name="ph-arrow-up-right" size={14} />{imageLabel}</span>}
    </div>}
  </section>;
}

export function EditorialCTA({ title = "Plan your next trip", description = "Choose a car, share your plans, and let our team confirm the details.", href = "/price-calculator", action = "Plan your journey" }: { title?: string; description?: string; href?: string; action?: string }) {
  return <div className={styles.cta}><div><h2>{title}</h2><p>{description}</p></div><div className={styles.actions}><Link href={href} className="btn btn-primary">{action}<Icon name="ph-arrow-right" size={18} /></Link></div></div>;
}
