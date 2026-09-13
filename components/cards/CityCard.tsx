import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import type { City } from "@/lib/types";
import styles from "./DiscoveryCard.module.css";

export function CityCard({ city, rail = false }: { city: City; rail?: boolean }) {
  return <Link href={`/cities/${city.slug}`} prefetch={false} className={`${styles.card} ${styles.city} ${rail ? styles.rail : ""}`}>
    <div className={styles.image}><Media src={city.heroImage} alt="" placeholder={city.name} icon="ph-map-pin" className="absolute inset-0" sizes={rail ? "(max-width: 767px) 165px, 220px" : "(max-width: 767px) 88px, (max-width: 1000px) 50vw, 25vw"} /></div>
    <div className={styles.body}><h3>{city.name}</h3><span className={styles.arrow}><Icon name="ph-arrow-up-right" size={18} /></span><p>{city.state}</p></div>
    <div className={styles.meta}><span>Explore city</span><span>Cars &amp; routes</span></div>
  </Link>;
}
