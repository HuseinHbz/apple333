'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main role="alert" className="p-8"><h1>خطایی رخ داد</h1><button onClick={reset}>تلاش دوباره</button></main>;}
