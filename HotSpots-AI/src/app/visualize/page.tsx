'use client';

import dynamic from 'next/dynamic';

const VisualizeMap = dynamic(() => import('./VisualizeMap'), {
    ssr: false,
});

export default function VisualizePage() {
    return <VisualizeMap />;
}
