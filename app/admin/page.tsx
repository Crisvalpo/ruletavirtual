'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import ScreenControlDashboard from '@/components/admin/ScreenControlDashboard';
import GlobalControlPanel from '@/components/admin/GlobalControlPanel';
import TicketSettingsManager from '@/components/admin/TicketSettingsManager';
import BatchTicketGenerator from '@/components/staff/BatchTicketGenerator';
import WheelManager from '@/components/admin/WheelManager';
import WheelUploader from '@/components/admin/WheelUploader';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function AdminDashboardPage() {
    return (
        <ProtectedRoute allowedRoles={['admin']}>
            <AdminContent />
        </ProtectedRoute>
    );
}

function AdminContent() {
    const [activeTab, setActiveTab] = useState<'monitoring' | 'tickets' | 'wheels'>('monitoring');

    const generateCode = () => {
        const letters = 'ABCDEF';
        const numbers = '0123456789';
        let res = '';
        for (let i = 0; i < 2; i++) res += letters.charAt(Math.floor(Math.random() * letters.length));
        res += '-';
        for (let i = 0; i < 3; i++) res += numbers.charAt(Math.floor(Math.random() * numbers.length));
        return res;
    };

    const tabs = [
        { id: 'monitoring', label: 'Monitorización', icon: '🖥️', description: 'Estado de pantallas y control maestro' },
        { id: 'tickets', label: 'Tickets & Seguridad', icon: '🎫', description: 'Configuración, activación y lotes' },
        { id: 'wheels', label: 'Temas de Ruleta', icon: '🎰', description: 'Gestión y carga de mundos' }
    ] as const;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-4 select-text overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                {/* Header - Minimalist row for buttons only */}
                <div className="flex justify-end mb-4 gap-3">
                    <button
                        onClick={() => window.location.href = '/staff/scanner'}
                        className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold px-4 py-2 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm"
                    >
                        📷 ESCÁNER
                    </button>
                    <button
                        onClick={() => window.location.href = '/staff/kiosk'}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm"
                    >
                        🎫 Kiosko
                    </button>
                </div>

                {/* Tabs Navigation - Compacted */}
                <nav className="flex flex-wrap bg-white p-1 rounded-2xl border border-slate-200 mb-6 shadow-sm relative overflow-hidden">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex-1 flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl transition-all relative z-10
                                ${activeTab === tab.id
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
                            `}
                        >
                            <span className="text-xl">{tab.icon}</span>
                            <span className="font-black text-[9px] uppercase tracking-widest">{tab.label}</span>
                        </button>
                    ))}
                </nav>


                {/* Tab Content */}
                <main className="animate-in fade-in zoom-in-95 duration-500">
                    {activeTab === 'monitoring' && (
                        <div className="grid gap-4">
                            <GlobalControlPanel />
                            <ScreenControlDashboard />
                        </div>
                    )}

                    {activeTab === 'tickets' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-8">
                                <TicketSettingsManager />
                            </div>
                            <div className="space-y-8">
                                <BatchTicketGenerator generateCode={generateCode} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'wheels' && (
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                            <div className="xl:col-span-1">
                                <WheelUploader />
                            </div>
                            <div className="xl:col-span-3">
                                <WheelManager />
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Global Overlay Styles for Premium formal Look */}
            <style jsx global>{`
                .glass-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 1.5rem;
                    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
                }
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: #f8fafc;
                }
                ::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </div>
    );
}
