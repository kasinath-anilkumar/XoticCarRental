"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { calculatorJourneyHref } from "@/lib/journey-params";

interface Props {
  params: string;
  packageSlug: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function ResolvedLink({ params, packageSlug, ...props }: Props) {
  const search = useSearchParams();
  return <Link {...props} href={calculatorJourneyHref(params, search.toString(), packageSlug)} />;
}

/** Only the query-aware link needs a client boundary; the car page stays static. */
export function JourneyCalculatorLink(props: Props) {
  const { params, packageSlug, ...linkProps } = props;
  return <Suspense fallback={<Link {...linkProps} href={calculatorJourneyHref(params, "", packageSlug)} />}>
    <ResolvedLink {...props} />
  </Suspense>;
}
