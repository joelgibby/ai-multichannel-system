// AI Multichannel System - Document Component
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="AI Multichannel System - Voice, SMS, and IPFS Storage" />
        <meta name="keywords" content="AI, chat, voice, SMS, IPFS, multichannel" />
        <meta name="author" content="AI Multichannel System" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#3b82f6" />
        
        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        
        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        
        {/* Manifest */}
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Preconnect to external resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Open Graph */}
        <meta property="og:title" content="AI Multichannel System" />
        <meta property="og:description" content="Chat with AI via Voice, SMS, and Web" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI Multichannel System" />
        <meta name="twitter:description" content="Chat with AI via Voice, SMS, and Web" />
        <meta name="twitter:image" content="/og-image.png" />
        
        {/* Robots */}
        <meta name="robots" content="index, follow" />
        
        {/* Scripts */}
        <script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
