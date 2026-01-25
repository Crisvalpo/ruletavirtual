'use client';

import { useEffect, useRef } from 'react';
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
    segments
}: WheelCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rotationRef = useRef(0);
    const speedRef = useRef(0);
    const requestRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const wheelSegments = segments || ANIMAL_LIST;
        const totalSegments = wheelSegments.length;
        const segmentAngle = (2 * Math.PI) / totalSegments;

        // Reset if starting fresh spin
        if (isSpinning && targetIndex === null) {
            speedRef.current = 0.2; // Max speed
        }

        const drawWheel = () => {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = Math.min(centerX, centerY) - 20;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Use passed segments or default animals
            const items = segments || ANIMAL_LIST.map(a => ({
                id: a.id,
                label: a.name,
                color: a.color,
                emoji: a.emoji,
                image: a.imageWheel
            }));

            // Draw Segments
            items.forEach((item, i) => {
                const angle = rotationRef.current + i * segmentAngle;

                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, angle, angle + segmentAngle);
                ctx.fillStyle = item.color || (i % 2 === 0 ? '#ffcc00' : '#ff4400');
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(angle + segmentAngle / 2);
                ctx.textAlign = 'right';

                // Text/Emoji Rendering
                if (item.emoji) {
                    ctx.font = 'bold 24px Arial';
                    ctx.fillStyle = '#000';
                    ctx.fillText(item.emoji, radius - 25, 8);
                } else if (item.label) {
                    ctx.font = 'bold 16px Arial';
                    ctx.fillStyle = '#000';
                    ctx.fillText(item.label.substring(0, 10), radius - 25, 5);
                }

                // ID Number
                ctx.font = '10px Arial';
                ctx.fillStyle = '#fff';
                ctx.fillText(`${item.id}`, radius - (totalSegments > 20 ? 55 : 40), 5); // Adjust for density

                ctx.restore();
            });

            // Draw Center Hub
            ctx.beginPath();
            ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.stroke();

            // Draw Pointer (Triangle at 3 o'clock position usually 0/2PI in canvas arc, but we need to check orientation)
            // By default 0 is 3 o'clock. 
            // We draw pointer at 0 angle (Right side) pointing left.
            ctx.beginPath();
            ctx.moveTo(centerX + radius + 10, centerY);
            ctx.lineTo(centerX + radius - 20, centerY - 10);
            ctx.lineTo(centerX + radius - 20, centerY + 10);
            ctx.fillStyle = 'red';
            ctx.fill();
        };

        let animationFrameId: number;

        const animate = () => {
            if (isSpinning) {
                if (targetIndex !== null) {
                    // Calculate target angle to stop at 3 o'clock (angle 0)
                    // The pointer is at angle 0.
                    // To show segment T at angle 0, the wheel rotation must put segment T there.
                    // Segment i starts at rotation + i * segmentAngle.
                    // We want rotation + targetIndex * segmentAngle + segmentAngle/2 = 2PI * K (or 0)
                    // Wait, usually items are 0-indexed. targetIndex is likely 1-indexed ID? 
                    // Let's assume targetIndex is the ID.

                    // Find index of target
                    const targetIdx = wheelSegments.findIndex(s => s.id === targetIndex);
                    if (targetIdx !== -1) {
                        // Target Angle relative to wheel start
                        const segmentCenter = targetIdx * segmentAngle + segmentAngle / 2;

                        // We want this segmentCenter to end up at Angle 0 (Pointer position)
                        // So Rotation + segmentCenter = 2PI * N.
                        // Target Rotation = (2PI * N) - segmentCenter.

                        // Current Rotation mod 2PI
                        const currentRot = rotationRef.current;

                        // Distance to travel: We want to spin a few more times then stop.
                        // This complex logic is easier simplified:
                        // Just stop when speed is super low? No, must stop at specific spot.

                        // SIMPLIFIED LOGIC FOR DEMO:
                        // Just stop deceleration when "close enough" is harder without pre-calc.
                        // Let's just snap to it for MVP or use a fixed duration tween?

                        // Better: Pre-calculate end rotation when target is received.
                        // But here we are in the loop. 

                        // Let's implement a friction stop.
                        speedRef.current *= 0.98; // Decelerate

                        // STOP CONDITION (Hack for MVP stability):
                        // If speed is very low, snap to target and stop.
                        if (speedRef.current < 0.005) {
                            speedRef.current = 0;

                            // Calculate final snap angle
                            // We want the target segment to be at 0 (East).
                            // pointer is at 0.
                            const targetOffset = -(targetIdx * segmentAngle + segmentAngle / 2);
                            // Normalize angle
                            rotationRef.current = targetOffset;

                            if (onSpinComplete) {
                                onSpinComplete(targetIndex);
                            }
                            // Stop animation loop for "spinning" state, but keep drawing?
                            // React state will update to 'result', setting isSpinning false.
                        }
                    }
                } else {
                    // Spin up or constant
                    if (speedRef.current < 0.5) speedRef.current += 0.01;
                }
                rotationRef.current += speedRef.current;
            }

            drawWheel();
            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => cancelAnimationFrame(animationFrameId);
    }, [isSpinning, targetIndex, segments]); // Re-bind when props change

    return (
        <div className="relative w-full aspect-square max-w-lg mx-auto">
            <canvas
                ref={canvasRef}
                width={500}
                height={500}
                className="w-full h-full"
            />
        </div>
    );
}
