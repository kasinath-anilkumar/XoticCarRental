import type { Metadata } from "next";
import Link from "next/link";
import { EditorialIntro, EditorialCTA, editorial } from "@/components/content/Editorial";
import { GalleryViewer } from "@/components/gallery/GalleryViewer";
import { getCatalog } from "@/lib/content";
import { galleryFromCars } from "@/lib/gallery";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Fleet Gallery | Xotic", description: "Take a closer look at the images in our vehicle listings and find inspiration for your journey.", alternates: { canonical: "/gallery" }, openGraph: { url: `${siteUrl()}/gallery` } };
type Params = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function GalleryPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const raw = Array.isArray(params.category) ? params.category[0] : params.category;
  const catalog = await getCatalog();
  const categories = galleryFromCars(catalog.cars);
  const frameCount = categories.reduce((total, category) => total + category.frames.length, 0);
  return <div className={editorial.page}>
    <EditorialIntro eyebrow="Fleet gallery" title="Take a closer look at our cars" description="Browse photos from our vehicle listings. Open an image to see the details, then view the car and its packages." actions={<Link href="/cars" className="btn btn-primary">View cars</Link>} />
    <section className={editorial.section} style={{paddingTop: 0}}>{frameCount > 0 ? <GalleryViewer categories={categories} initialCategorySlug={raw ? String(raw) : undefined} whatsappNumber={catalog.settings.whatsappNumber} /> : <div className={editorial.card}><h2 className="text-xl">Vehicle images are being updated</h2><p>Contact our team for current vehicle photos and availability.</p><Link href="/contact" className="btn btn-primary mt-3">Contact our team</Link></div>}<p className={editorial.note}>Images come from our vehicle listings. Confirm the current vehicle, condition and availability with our team before booking.</p></section>
    <section className={editorial.section}><EditorialCTA title="Picture your next journey." description="Explore the fleet, compare the details and create a trip estimate around your plans." href="/cars" action="Find your car" /></section>
  </div>;
}
