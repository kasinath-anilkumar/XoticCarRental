import { Icon } from "@/components/ui/Icon";
import { GENERAL_ENQUIRY_MESSAGE, whatsappLink } from "@/lib/whatsapp";
import type { SiteSettings } from "@/lib/types";
import styles from "./SiteFooter.module.css";

/** A short invitation to get personal help before the footer. */
export function WhatsAppBanner({ settings }: { settings: SiteSettings }) {
  return (
    <section className={styles.invitation} aria-labelledby="concierge-heading">
      <div>
        <p className="kick">A little help planning?</p>
        <h2 id="concierge-heading"><span className={styles.desktopInvitation}>Let’s make it<br /><em>a journey to remember.</em></span><span className={styles.mobileInvitation}>Need help planning?</span></h2>
        <p>Share your plans, ask about a car, or arrange something a little out of the ordinary.</p>
      </div>
      <a
        className={`btn ${styles.chat}`}
        href={whatsappLink(settings.whatsappNumber, GENERAL_ENQUIRY_MESSAGE)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="ph-whatsapp-logo" size={22} /> Chat on WhatsApp <Icon name="ph-arrow-up-right" size={20} />
      </a>
    </section>
  );
}
