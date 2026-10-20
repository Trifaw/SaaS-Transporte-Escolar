import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Expresso Escolar — App do Motorista',
    short_name: 'Motorista Van',
    description: 'App PWA de alto contraste para motoristas de transporte escolar',
    start_url: '/driver',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#020617',
    theme_color: '#f59e0b',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '64x64',
        type: 'image/x-icon',
      },
    ],
  };
}
