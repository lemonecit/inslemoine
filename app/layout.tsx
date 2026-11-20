import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Lexend } from "next/font/google";
import { INIT_SCRIPT } from "@/lib/a11y-prefs";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import FocusAssist from "@/components/FocusAssist";
import ConsentBanner from "@/components/ConsentBanner";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Chargée uniquement si la personne active l'option « Lecture facilitée ».
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Inclusion numérique`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Pour un monde numérique sans barrières`,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Pour un monde numérique sans barrières`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a1a33",
};

const organization = {
  "@context": "https://schema.org",
  "@type": "NGO",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  slogan: "Pour un monde numérique sans barrières.",
  areaServed: "FR",
  inLanguage: "fr",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Paris",
    addressCountry: "FR",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${atkinson.variable} ${lexend.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organization).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#contenu-principal">
          Aller au contenu principal
        </a>
        {children}
        <FocusAssist />
        <ConsentBanner />
      </body>
    </html>
  );
}
