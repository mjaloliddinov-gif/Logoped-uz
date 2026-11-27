import type {NextConfig} from "next";
const security=[
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:'DENY'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
 {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains'},
];
const config:NextConfig={poweredByHeader:false,serverExternalPackages:["pg"],
 async headers(){return [
  {source:'/:path*',headers:security},
  // A stale service worker would pin users to old code, so browsers must always revalidate it.
  {source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache, no-store, must-revalidate'},{key:'Content-Type',value:'application/javascript; charset=utf-8'}]},
  {source:'/icons/:path*',headers:[{key:'Cache-Control',value:'public, max-age=86400'}]},
 ]}};
export default config;
