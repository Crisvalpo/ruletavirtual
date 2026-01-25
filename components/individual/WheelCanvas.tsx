'use client';

import { useEffect, useRef, useState } from 'react';
import { ANIMAL_LIST } from '@/lib/constants/animals';

interface WheelSegment {
    id: number;
    label: string;
    color: string;
    image?: string;
    emoji?: string;
}

interface WheelCanvasProps {
    onSpinComplete?: (result: number) => void;
    isSpinning?: boolean;
    targetIndex?: number | null; // 1-36
    segments?: WheelSegment[]; // Optional: if provided, overrides default ANIMAL_LIST
}

export default function WheelCanvas({
    onSpinComplete,
    isSpinning = false,
    targetIndex = null,
    segments,
    className = ""
}: WheelCanvasProps & { className?: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rotationRef = useRef(0);
    const speedRef = useRef(0);
    const requestRef = useRef<number>(0);
    const imagesRef = useRef<{ [key: string]: HTMLImageElement }>({});
    const loadedCountRef = useRef(0);

    // DEFAULT IDLE SEGMENTS (12 generic segments for Individual Mode Idle)
    const DEFAULT_IDLE_SEGMENTS = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        label: `Juega`,
        color: i % 2 === 0 ? '#ffcc00' : '#ff4400',
        emoji: '🎰'
    }));

    // Filter segments that have images
    // If segments is undefined, use DEFAULT_IDLE_SEGMENTS (12) instead of ANIMAL_LIST (36)
    // This fixes the "Group Wheel in Individual Mode" issue.
    const effectiveSegments = segments || DEFAULT_IDLE_SEGMENTS;

    const items = effectiveSegments.map((a: any) => ({
        id: a.id,
        label: a.label || a.name, // Handle both structures
        color: a.color,
        emoji: a.emoji,
        image: a.imageWheel || a.image
    }));

    // Preload Images
    useEffect(() => {
        const imagesToLoad = items.filter(i => i.image);
        if (imagesToLoad.length === 0) return;

        loadedCountRef.current = 0;

        imagesToLoad.forEach(item => {
            if (item.image && !imagesRef.current[item.image]) {
                const img = new Image();
                img.src = item.image;
                img.onload = () => {
                    loadedCountRef.current += 1;
                };
                imagesRef.current[item.image] = img;
            } else if (item.image && imagesRef.current[item.image]) {
                // Already loaded
                loadedCountRef.current += 1;
            }
        });
    }, [items]); // Re-run if map items change (e.g. wheel change)

    // State for smooth stopping
    const stoppingRef = useRef<{
        startRotation: number;
        targetRotation: number;
        startTime: number;
        duration: number;
    } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const wheelSegments = segments || ANIMAL_LIST;
        const totalSegments = wheelSegments.length;
        const segmentAngle = (2 * Math.PI) / totalSegments;
        const isFanMode = totalSegments <= 20;

        // Start Spin Logic
        if (isSpinning && targetIndex === null) {
            speedRef.current = 0.05; // Initial kickoff
            stoppingRef.current = null;
        }

        // On Target Received Logic
        if (isSpinning && targetIndex !== null && !stoppingRef.current) {
            const targetIdx = wheelSegments.findIndex(s => s.id === targetIndex);
            if (targetIdx !== -1) {
                // Calculate stopping distance
                // We want to land such that (Rotation + segmentCenter) aligns with Pointer (Angle 0 or PI depending on implementation)
                // Pointer is fixed.
                // For Fan Mode (PI/2 rotation drawing), Pointer is at BOTTOM (Angle PI/2)
                // Wait, previous code:
                // Fan Mode Pointer: Bottom Center (Angle PI/2 relative to Canvas Center?)
                // Standard Mode Pointer: Right (Angle 0).

                // Let's identify Pointer Angle in Radians (Wheel Space).
                // Fan Mode Loop: drawWheel clears.
                // items drawn at `rotationRef.current + i * segmentAngle`.
                // Pointer Drawing: `moveTo(centerX, ptrY - 10)` which is effectively Bottom.
                // Bottom in standard arc terms is PI/2 (90 deg).
                // So Pointer Angle = Math.PI / 2.

                // We want Target Segment Center to range [PointerAngle - e, PointerAngle + e].
                // Target Segment Center = Rotation + idx * segAngle + segAngle/2.
                // Loop Goal: Rotation + idx*segAngle + segAngle/2 = Math.PI/2 + 2PI*k.

                // So Target Rotation = Math.PI/2 - (idx * segAngle + segAngle/2) + 2PI*k.

                const pointerAngle = isFanMode ? Math.PI / 2 : 0;

                // Current Rotation
                const currentRot = rotationRef.current;

                // Base Target (normalized)
                const baseTarget = pointerAngle - (targetIdx * segmentAngle + segmentAngle / 2);

                // Ensure we spin at least 2 full rounds more
                // Find next 2PI*k greater than currentRot + 4PI
                const minDistance = Math.PI * 4; // 2 spins
                let targetRot = baseTarget;
                while (targetRot < currentRot + minDistance) {
                    targetRot += Math.PI * 2;
                }

                // Add random variation within segment? No, center is cleaner.

                stoppingRef.current = {
                    startRotation: currentRot,
                    targetRotation: targetRot,
                    startTime: performance.now(),
                    duration: 4000 // 4 seconds deceleration
                };
            }
        }

        const easeOutCubic = (t: number): number => {
            return 1 - Math.pow(1 - t, 3);
        };

        const drawWheel = () => {
            const centerX = canvas.width / 2;
            let centerY = canvas.height / 2;
            let radius = Math.min(centerX, centerY) - 20;

            if (isFanMode) {
                centerY = 0;
                const maxRadiusByWidth = (canvas.width / 2) - 20;
                const maxRadiusByHeight = canvas.height - 50;
                radius = Math.min(maxRadiusByWidth, maxRadiusByHeight);
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            items.forEach((item, i) => {
                const angle = rotationRef.current + i * segmentAngle;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, angle, angle + segmentAngle);
                ctx.fillStyle = item.color || (i % 2 === 0 ? '#ffcc00' : '#ff4400');
                ctx.fill();

                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(angle + segmentAngle / 2);

                if (item.image && imagesRef.current[item.image] && imagesRef.current[item.image].complete) {
                    const img = imagesRef.current[item.image];
                    const aspect = img.naturalWidth / img.naturalHeight;
                    let imgHeight, imgWidth, dist;

                    if (isFanMode) {
                        imgHeight = radius;
                        imgWidth = imgHeight * aspect * 1.0;
                        dist = radius / 2;
                    } else {
                        imgWidth = 40;
                        imgHeight = 40;
                        dist = radius * 0.7;
                    }

                    ctx.save();
                    ctx.translate(dist, 0);

                    if (isFanMode) {
                        ctx.rotate(Math.PI / 2);
                    } else {
                        ctx.rotate(Math.PI / 2);
                    }

                    ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                    ctx.restore();
                }
                ctx.restore();
            });

            // Pointer
            if (isFanMode) {
                const ptrY = centerY + radius;
                ctx.beginPath();
                ctx.moveTo(centerX, ptrY - 10);
                ctx.lineTo(centerX - 15, ptrY + 20);
                ctx.lineTo(centerX + 15, ptrY + 20);
            } else {
                ctx.beginPath();
                ctx.moveTo(centerX + radius + 10, centerY);
                ctx.lineTo(centerX + radius - 20, centerY - 10);
                ctx.lineTo(centerX + radius - 20, centerY + 10);
            }
            ctx.fillStyle = 'red';
            ctx.fill();
        };

        const animate = (time: number) => {
            if (isSpinning) {
                if (stoppingRef.current) {
                    // Deceleration Phase
                    const { startTime, duration, startRotation, targetRotation } = stoppingRef.current;
                    const elapsed = time - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const ease = easeOutCubic(progress);

                    rotationRef.current = startRotation + (targetRotation - startRotation) * ease;

                    if (progress >= 1) {
                        // Finished
                        if (onSpinComplete) onSpinComplete(targetIndex!);
                        // Do not loop anymore
                    }
                } else {
                    // Acceleration / Constant Speed Phase
                    if (speedRef.current < 0.3) { // Max speed cap
                        speedRef.current += 0.005;
                    }
                    rotationRef.current += speedRef.current;
                }
            }

            drawWheel();

            // Continue loop only if spinning AND not finished stopping
            if (isSpinning && (!stoppingRef.current || (performance.now() - stoppingRef.current.startTime < stoppingRef.current.duration))) {
                animationFrameId = requestAnimationFrame(animate);
            } else if (isSpinning && stoppingRef.current) {
                // Ensure final frame is drawn perfectly
                drawWheel();
            } else {
                // Idle loop just to draw
                // animationFrameId = requestAnimationFrame(animate);
                // Actually, if we stop spinning, react state changes 'status' to 'result'.
                // Then isSpinning becomes false. We can stop animating or just draw once.
            }
        };

        let animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isSpinning, targetIndex, segments]); // Re-bind when props change

    return (
        <div className={`relative w-full aspect-square ${className}`}>
            <canvas
                ref={canvasRef}
                width={1000} // Increased resolution for sharp rendering on large screens
                height={1000}
                className="w-full h-full"
            />
        </div>
    );
}
