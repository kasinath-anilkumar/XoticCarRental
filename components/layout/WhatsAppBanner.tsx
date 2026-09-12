import { Icon } from "@/components/ui/Icon";
import { GENERAL_ENQUIRY_MESSAGE, whatsappLink } from "@/lib/whatsapp";
import type { SiteSettings } from "@/lib/types";

/**
 * The green band above the footer. The one place the design lets a saturated
 * colour flood an area — the brand green *is* the affordance here.
 *
 * The gutter is read straight from the token: `--gutter-desktop` already
 * collapses to the mobile value below 768px, so the inline padding needs no
 * variant of its own.
 *
 * The CTA takes the global `.wa-ink` rather than restating dark-on-green: it is
 * the same three declarations, and this component had its own copy that the
 * global `.btn` was quietly overriding until the component layer went in.
 */
export function WhatsAppBanner({ settings }: { settings: SiteSettings }) {
  return (
    <section className="flex items-center gap-6 bg-whatsapp px-(--gutter-desktop) py-8 text-whatsapp-ink max-md:gap-4 max-md:py-6">
      <Icon name="ph-whatsapp-logo" size={34} weight="fill" className="flex-none" />
      <div className="flex-1">
        <p className="m-0 font-heading text-[19px] leading-tight font-semibold max-md:text-[14px]">
          Questions, custom routes, or a fleet for a function?
        </p>
        <p className="m-0 text-[13px] opacity-80 max-md:text-[11px]">
          Message us — quotes, driver details and confirmation all happen on WhatsApp.
        </p>
      </div>
      <a
        className="btn wa-ink h-[42px] flex-none px-8 max-md:h-[40px] max-md:px-5 max-md:text-[13px]"
        href={whatsappLink(settings.whatsappNumber, GENERAL_ENQUIRY_MESSAGE)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Chat on WhatsApp
      </a>
    </section>
  );
}
