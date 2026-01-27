'use client';

import { useState } from 'react';
import WheelUploader from '@/components/admin/WheelUploader';
import GlobalControlPanel from '@/components/admin/GlobalControlPanel';
import WheelManager from '@/components/admin/WheelManager';

export default function AdminWheelsPage() {
    const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'list'>('overview');

    const tabs = [
        { id: 'overview', label: 'Resumen', icon: '📊' },
        { id: 'upload', label: 'Subir Nueva', icon: '📤' },
        { id: 'list', label: 'Configurar', icon: '⚙️' }
    ] as const;

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
                        🎰 Gestión de Ruletas
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">Panel de control de temáticas y estados de pantalla</p>
                </header>

                {/* Tabs Navigation */}
                <div className="flex bg-white p-1 rounded-xl shadow-sm border mb-8 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all whitespace-nowrap
                                ${activeTab === tab.id
                                    ? 'bg-orange-500 text-white shadow-md'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
                            `}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="grid gap-8 animate-in fade-in duration-500">
                    {activeTab === 'overview' && (
                        <GlobalControlPanel />
                    )}

                    {activeTab === 'upload' && (
                        <WheelUploader />
                    )}

                    {activeTab === 'list' && (
                        <WheelManager />
                    )}
                </div>
            </div>
        </div>
    );
}
