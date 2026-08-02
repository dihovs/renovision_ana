"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { localizeHref } from "@/i18n/routing";

/**
 * `next/link` that keeps you in the language you are already reading.
 *
 * Every internal href in the marketing tree is written once, unprefixed
 * (`/services/flooring`), and this adds `/en` when the current route is
 * English. The alternative was threading the locale through forty href
 * literals; swapping the import in the dozen files that link internally is the
 * smaller change and cannot be forgotten halfway.
 *
 * External, protocol-relative, `tel:` and `mailto:` hrefs pass through
 * untouched, as do the query string and hash of an internal one.
 */
export default function LocaleLink({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const { locale } = useLanguage();
  return <NextLink href={typeof href === "string" ? localizeHref(locale, href) : href} {...rest} />;
}
