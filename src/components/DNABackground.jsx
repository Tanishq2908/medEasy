import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { cn } from './Button';

const NeuralHelix = ({ theme }) => {
  // Ultra-Dynamic "Neural Helix" - Diagonal revolving double-helix
  // High density of pairs for a tight, detailed, curved strand
  const pairs = Array.from({ length: 200 }); 
  
  // Theme-aware colors
  const colorA = theme === 'light' ? '#0284c7' : '#22d3ee'; // Darker Cyan for Light
  const colorB = theme === 'light' ? '#4f46e5' : '#ec4899'; // Darker Indigo for Light
  const glowA = theme === 'light' ? 'rgba(2, 132, 199, 0.3)' : 'rgba(34, 211, 238, 0.6)';
  const glowB = theme === 'light' ? 'rgba(79, 70, 229, 0.3)' : 'rgba(236, 72, 153, 0.6)';
  const bgColor = theme === 'light' ? '#f8fafc' : '#020617';
  const pulseColor = theme === 'light' ? 'rgba(2, 132, 199, 0.2)' : 'rgba(34, 211, 238, 0.3)';

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[0]" style={{ backgroundColor: bgColor }}>
      {/* Dynamic Mesh Glimmer */}
      <div className="absolute top-0 left-0 w-full h-full" 
        style={{ 
          background: theme === 'light' 
            ? 'radial-gradient(circle_at_20%_20%, rgba(14, 165, 233, 0.05), transparent 70%)'
            : 'radial-gradient(circle_at_20%_20%, rgba(14, 116, 144, 0.15), transparent 70%)'
        }} 
      />
      <div className="absolute bottom-0 right-0 w-full h-full"
        style={{ 
          background: theme === 'light'
            ? 'radial-gradient(circle_at_80%_80%, rgba(99, 102, 241, 0.05), transparent 70%)'
            : 'radial-gradient(circle_at_80%_80%, rgba(67, 56, 202, 0.15), transparent 70%)'
        }}
      />
      
      {/* High-Velocity Diagonal Helix */}
      <div className="absolute inset-x-[-50%] inset-y-[-50%] flex items-center justify-center rotate-[35deg] scale-[1.3]">
        <div className="relative w-80 flex flex-col items-center">
          {pairs.map((_, i) => (
            <div
              key={i}
              className="relative w-full h-5 flex items-center justify-center"
              style={{
                perspective: '1500px',
                marginTop: '-5px',
                transformStyle: 'preserve-3d'
              }}
            >
              {/* Helix Core Rotation */}
              <motion.div
                animate={{ rotateY: [0, 360] }}
                transition={{
                  duration: 5.0,
                  repeat: Infinity,
                  ease: "linear",
                  delay: i * 0.05
                }}
                className="relative w-full h-full flex items-center justify-between px-20"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Backbone Segment A */}
                <div 
                  className={cn("absolute w-[1.5px] h-8 opacity-40")} 
                  style={{ 
                    transform: 'translateZ(100px) translateY(-50%)',
                    backgroundColor: colorA,
                    left: '5rem', // px-20 equivalent
                  }} 
                />

                {/* Nucleotide Node A */}
                <div 
                  className={cn("w-2.5 h-2.5 rounded-full ring-2 z-10", theme === 'light' ? 'ring-black/5' : 'ring-white/20')} 
                  style={{ 
                    transform: 'translateZ(100px)',
                    backgroundColor: colorA,
                    boxShadow: `0 0 20px ${glowA}`
                  }} 
                />
                
                {/* Hydrogen Bond (Rung) */}
                <div 
                  className={cn("h-[2px] flex-grow mx-2", theme === 'light' ? 'opacity-100' : 'opacity-60')} 
                  style={{ 
                    transform: 'translateZ(0px)',
                    background: `linear-gradient(to right, ${colorA}, ${colorB})`
                  }} 
                />
                
                {/* Nucleotide Node B */}
                <div 
                  className={cn("w-2.5 h-2.5 rounded-full ring-2 z-10", theme === 'light' ? 'ring-black/5' : 'ring-white/20')} 
                  style={{ 
                    transform: 'translateZ(-100px)',
                    backgroundColor: colorB,
                    boxShadow: `0 0 20px ${glowB}`
                  }} 
                />

                {/* Backbone Segment B */}
                <div 
                  className={cn("absolute w-[1.5px] h-8 opacity-40")} 
                  style={{ 
                    transform: 'translateZ(-100px) translateY(-50%)',
                    backgroundColor: colorB,
                    right: '5rem', // px-20 equivalent
                  }} 
                />
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* Atmospheric Overlays */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0" 
        style={{ 
          background: `linear-gradient(to t, ${bgColor} 0%, transparent 20%, transparent 80%, ${bgColor} 100%)`,
          opacity: theme === 'light' ? 0.4 : 0.8 
        }} 
      />
      
      {/* Neural Pulse Particles */}
      {[...Array(40)].map((_, i) => (
        <motion.div
            key={`p-${i}`}
            initial={{ 
              x: Math.random() * 3000 - 1500, 
              y: Math.random() * 2000 + 500,
              opacity: Math.random() * 0.5
            }}
            animate={{
              y: [null, -1000],
              opacity: [null, 0]
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute w-1 h-1 rounded-full blur-[1px]"
            style={{ backgroundColor: pulseColor }}
        />
      ))}
    </div>
  );
};

const DNABackground = () => {
  const { theme } = useTheme();
  return <NeuralHelix theme={theme} />;
};

export default DNABackground;
