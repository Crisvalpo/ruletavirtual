'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import ScreenControlDashboard from '@/components/admin/ScreenControlDashboard';
import GlobalControlPanel from '@/components/admin/GlobalControlPanel';
import TicketSettingsManager from '@/components/admin/TicketSettingsManager';
import BatchTicketGenerator from '@/components/staff/BatchTicketGenerator';
import WheelManager from '@/components/admin/WheelManager';
import WheelUploader from '@/components/admin/WheelUploader';

export default function AdminDashboardPage() {
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
        <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-3xl">📊</span>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Panel de Administración</h1>
                        </div>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sistema de Control Centralizado • Hub 2026</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => window.location.href = '/staff/scanner'}
                            className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold px-6 py-3 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm"
                        >
                            📷 ESCÁNER
                        </button>
                        <button
                            onClick={() => window.location.href = '/staff/kiosk'}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-slate-200"
                        >
                            🎫 Abrir Kiosko
                        </button>
                    </div>
                </header>

                {/* Tabs Navigation */}
                <nav className="flex flex-wrap bg-white p-1.5 rounded-2xl border border-slate-200 mb-10 shadow-sm relative overflow-hidden">
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

                {/* Tab Context Info */}
                <div className="mb-8 px-2 flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="w-1 h-8 bg-indigo-500 rounded-full" />
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">
                            {tabs.find(t => t.id === activeTab)?.label}
                        </h2>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                            {tabs.find(t => t.id === activeTab)?.description}
                        </p>
                    </div>
                </div>

                {/* Tab Content */}
                <main className="animate-in fade-in zoom-in-95 duration-500">
                    {activeTab === 'monitoring' && (
                        <div className="grid gap-8">
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
