'use client';

import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useRouter } from 'next/navigation';

export default function StaffScannerPage() {
    const router = useRouter();
    const [scanResult, setScanResult] = useState<string | null>(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                videoConstraints: {
                    facingMode: "environment"
                }
            },
            /* verbose= */ false
        );

        scanner.render(onScanSuccess, onScanFailure);

        function onScanSuccess(decodedText: string) {
            // Check if the decoded text is a URL from our domain or just a code
            let code = decodedText;
            if (decodedText.includes('/staff/validate/')) {
                code = decodedText.split('/staff/validate/').pop() || decodedText;
            } else if (decodedText.includes('/ticket/view/')) {
                code = decodedText.split('/ticket/view/').pop() || decodedText;
            }

            setScanResult(code);
            scanner.clear(); // Stop scanning
            router.push(`/staff/validate/${code}`);
        }

        function onScanFailure(error: any) {
            // Quietly ignore or handle scan failures
            // console.warn(`Code scan error = ${error}`);
        }

        return () => {
            scanner.clear().catch(err => console.error("Failed to clear scanner", err));
        };
    }, [router]);

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8 flex flex-col items-center">
            <header className="w-full max-w-lg mb-8 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">📷</span>
                    <h1 className="text-2xl font-black uppercase italic tracking-tighter">Escáner Staff</h1>
                </div>
                <button
                    onClick={() => router.push('/admin')}
                    className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-bold"
                >
                    SALIR
                </button>
            </header>

            <main className="w-full max-w-lg">
                <div className="bg-[#111] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden mb-8">
                    <div id="reader" className="rounded-2xl overflow-hidden border-4 border-yellow-500/20"></div>

                    <div className="mt-6 text-center">
                        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-1">
                            Apunta la cámara al QR
                        </p>
                        <p className="text-[10px] text-gray-600 uppercase">
                            Tickets masivos o individuales
                        </p>
                    </div>
                </div>

                <div className="bg-yellow-500/5 border border-yellow-500/20 p-6 rounded-2xl flex items-start gap-4">
                    <span className="text-xl">ℹ️</span>
                    <div>
                        <p className="text-xs text-yellow-500 font-bold uppercase leading-relaxed">
                            Esta herramienta permite activar preventas y pagar premios.
                        </p>
                        <p className="text-[10px] text-yellow-500/60 mt-1 uppercase">
                            Para consultas de cliente, use la cámara normal del celular.
                        </p>
                    </div>
                </div>
            </main>

            <style jsx global>{`
                #reader__scan_region {
                    background: transparent !important;
                }
                #reader__dashboard {
                    background: transparent !important;
                    color: white !important;
                    padding: 20px 0 !important;
                }
                #reader__dashboard button {
                    background: #facc15 !important;
                    color: black !important;
                    border: none !important;
                    padding: 10px 20px !important;
                    border-radius: 12px !important;
                    font-weight: 900 !important;
                    text-transform: uppercase !important;
                    font-size: 12px !important;
                    cursor: pointer !important;
                }
                #reader__status_span {
                    color: #666 !important;
                    font-size: 10px !important;
                }
            `}</style>
        </div>
    );
}
