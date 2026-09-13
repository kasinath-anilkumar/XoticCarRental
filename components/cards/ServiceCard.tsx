import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import { formatINR } from "@/lib/format";
import { serviceFromPrice, type Service } from "@/lib/services";
import styles from "./DiscoveryCard.module.css";

export function ServiceCard({ service, image }: { service: Service; image: string | null }) {
  const from = serviceFromPrice(service);
  return <Link href={`/services/${service.slug}`} prefetch={false} className={styles.card}>
    <div className={styles.image}><Media src={image} alt="" placeholder={service.short} icon={service.icon} className="absolute inset-0" sizes="(max-width: 767px) 88px, (max-width: 1000px) 50vw, 33vw" /></div>
    <div className={styles.body}><h3>{service.short}</h3><span className={styles.arrow}><Icon name="ph-arrow-up-right" size={18} /></span><p>{service.tagline}</p></div>
    <div className={styles.meta}><span>View packages</span>{from !== null && <span>From <strong>{formatINR(from)}</strong></span>}</div>
  </Link>;
}
