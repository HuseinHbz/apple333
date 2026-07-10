import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Apple333 Enterprise',description:'Apple333 enterprise platform foundation'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body>{children}</body></html>;}
