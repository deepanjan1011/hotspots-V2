
'use client';

import { motion } from 'framer-motion';

export const EcoFlameLogo = () => {
    return (
        <div className="relative inline-flex items-center justify-center w-10 h-10 mr-1.5 mb-2.5 align-middle">
            {/* Flame Layer */}
            <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="url(#flameGradient)"
                className="absolute w-full h-full"
                animate={{
                    scale: [1, 1.05, 0.98, 1.02, 1],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.25, 0.5, 0.75, 1]
                }}
            >
                <defs>
                    <linearGradient id="flameGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f97316" /> {/* Orange-500 */}
                        <stop offset="100%" stopColor="#ea580c" /> {/* Orange-600 */}
                    </linearGradient>
                </defs>
                <path d="M8.5 14.5A2.5 2.5 0 0011 17c1.38 0 2.5-1.12 2.5-2.5 0-1.38-.56-2.63-1.5-3.5C13 12 14 13.5 14 14.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5c0-2.5-2-4.5-4-6.5-1.5-1.5-2-3-2-4.5 0-.5.1-.96.26-1.4C10 3 6 7 6 12c0 1.2.43 2.3 1.14 3.16.89-1.05 1.36-1.66 1.36-1.66z" />
            </motion.svg>

            {/* Leaf Layer (Overlay) */}
            <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="url(#leafGradient)"
                className="absolute w-6 h-6 -top-1 -right-1"
                style={{ originY: 1, originX: 0 }}
                animate={{
                    rotate: [-3, 3, -3],
                    scale: [0.9, 1.05, 0.9],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                <defs>
                    <linearGradient id="leafGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4ade80" /> {/* Green-400 */}
                        <stop offset="100%" stopColor="#16a34a" /> {/* Green-600 */}
                    </linearGradient>
                </defs>
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
            </motion.svg>
        </div>
    );
};
