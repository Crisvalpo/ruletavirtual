'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Sale {
    id: string;
    code: string;
    package_type: string;
    buyer_name: string;
    created_at: string;
    plays_remaining: number;
}

export default function RecentSales() {
    const supabase = createClient();
    const [sales, setSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchRecentSales();

        // Real-time subscription
        const channel = supabase
            .channel('kiosk_sales')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'game_packages'
                },
                () => {
                    fetchRecentSales();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const fetchRecentSales = async () => {
        const { data, error } = await supabase
            .from('game_packages')
            .select('id, code, package_type, buyer_name, created_at, plays_remaining')
            .order('created_at', { ascending: false })
            .limit(20);

        if (!error && data) {
            setSales(data);
        }
        setIsLoading(false);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        alert(`Código ${code} copiado al portapapeles`);
    };

    if (isLoading) {
        return (
            <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                <p className="text-gray-400 text-center">Cargando ventas...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#111] border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-black text-white mb-4">Ventas Recientes</h3>

            {sales.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay ventas registradas</p>
            ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
                    {sales.map((sale) => (
                        <div
                            key={sale.id}
                            className="bg-black/30 border border-white/5 rounded-lg p-4 hover:bg-black/50 transition-all"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-mono text-yellow-500 font-bold">{sale.code}</p>
                                    <p className="text-sm text-gray-400">{sale.package_type}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">
                                        {new Date(sale.created_at).toLocaleString('es-CL', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                    <p className="text-xs text-gray-400">{sale.buyer_name}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-xs px-2 py-1 rounded ${sale.plays_remaining > 0
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                    }`}>
                                    {sale.plays_remaining > 0
                                        ? `${sale.plays_remaining} jugadas restantes`
                                        : 'Usado'}
                                </span>
                                <button
                                    onClick={() => copyCode(sale.code)}
                                    className="text-xs bg-white/5 hover:bg-white/10 text-white px-3 py-1 rounded transition-all active:scale-95"
                                >
                                    Copiar Código
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
