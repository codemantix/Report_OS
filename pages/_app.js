import Head from 'next/head';
import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../context/ThemeContext';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <Head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <title>Codemantix — Report OS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#FFFFFF',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#FFFFFF',
            },
          },
        }}
      />
    </ThemeProvider>
  );
}
