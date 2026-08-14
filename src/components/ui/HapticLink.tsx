"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { tapFeedback } from "@/lib/haptics";

/**
 * `next/link`, plus a tap. Exists only because Server Components can't pass
 * an event handler to a Client Component prop directly — the two pages that
 * need this (Home's heroes) are server-rendered for their data, so the
 * haptic has to live in this one-line wrapper instead of inline.
 */
export default function HapticLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        tapFeedback();
        onClick?.(event);
      }}
    />
  );
}
