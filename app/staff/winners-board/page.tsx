'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ANIMAL_LIST } from '@/lib/constants/animals';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

interface GameRecord {
    id: string;
    created_at: string;
    screen_number: number;
    player_name: string;
    player_emoji: string;
    player_id: string | null;
    selected_animals: number[];
    spin_result: number | null;
    prize_won: string | null;
    prize_payout_status: 'pending' | 'paid' | 'not_applicable';
    status: string;
    wheel_name: string;
}

export default function WinnersBoardPage() {
    return (
        <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <WinnersBoardContent />
        </ProtectedRoute>
    );
}

function WinnersBoardContent() {
    const supabase = createClient();
    const [records, setRecords] = useState<GameRecord[]>([]);
    const [filter, setFilter] = useState<'all' | 'won' | 'lost'>('won');
    const [screenFilter, setScreenFilter] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<GameRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchRecords();
    }, [filter, screenFilter]);

    const fetchRecords = async () => {
        setIsLoading(true);
        let query = supabase
            .from('player_queue')
            .select(`
                id,
                created_at,
                screen_number,
                player_name,
                player_emoji,
                player_id,
                selected_animals,
                spin_result,
                prize_won,
                prize_payout_status,
                status,
                screens!inner(
                    wheel_id,
                    individual_wheels(name)
                )
            `)
            .in('status', ['completed', 'abandoned'])
            .order('created_at', { ascending: false })
            .limit(100);

        if (filter === 'won') {
            query = query.not('prize_won', 'is', null);
        } else if (filter === 'lost') {
            query = query.is('prize_won', null);
        }

        if (screenFilter) {
            query = query.eq('screen_number', screenFilter);
        }

        const { data, error } = await query;

        if (!error && data) {
            const formatted = data.map((item: any) => ({
                ...item,
                wheel_name: item.screens?.individual_wheels?.name || 'Ruleta General'
            }));
            setRecords(formatted);
        }
        setIsLoading(false);
    };

    const markAsPaid = async (recordId: string) => {
        await supabase
            .from('player_queue')
            .update({ prize_payout_status: 'paid' })
            .eq('id', recordId);

        fetchRecords();
    };

    const filteredRecords = records.filter(r =>
        r.player_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        totalGames: records.length,
        totalWins: records.filter(r => r.prize_won).length,
        pendingPayouts: records.filter(r => r.prize_payout_status === 'pending').length,
        paidOut: records.filter(r => r.prize_payout_status === 'paid').length
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl font-black text-gray-900 mb-1">🏆 Pizarra de Ganadores</h1>
                    <p className="text-sm text-gray-500">Verificación de premios y gestión de pagos</p>
                </div>
            </div>

            {/* Stats */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Partidas</p>
                        <p className="text-2xl font-black text-gray-900">{stats.totalGames}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Premios Ganados</p>
                        <p className="text-2xl font-black text-green-600">{stats.totalWins}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pendientes</p>
                        <p className="text-2xl font-black text-yellow-600">{stats.pendingPayouts}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pagados</p>
                        <p className="text-2xl font-black text-blue-600">{stats.paidOut}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
                    <div className="flex gap-4 items-center flex-wrap">
                        {/* Tabs */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('won')}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'won'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Ganadas
                            </button>
                            <button
                                onClick={() => setFilter('lost')}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'lost'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Perdidas
                            </button>
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'all'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Todas
                            </button>
                        </div>

                        {/* Screen Filter */}
                        <select
                            value={screenFilter || ''}
                            onChange={(e) => setScreenFilter(e.target.value ? parseInt(e.target.value) : null)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                        >
                            <option value="">Todas las pantallas</option>
                            {[1, 2, 3, 4, 5].map(n => (
                                <option key={n} value={n}>Pantalla {n}</option>
                            ))}
                        </select>

                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Buscar por nickname..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                    </div>
                </div>

                {/* Records List */}
                {isLoading ? (
                    <div className="text-center py-20">
                        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
                        <p className="text-gray-400 text-sm">No se encontraron registros</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredRecords.map(record => (
                            <GameRecordCard
                                key={record.id}
                                record={record}
                                onVerify={() => setSelectedRecord(record)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Verification Modal */}
            {selectedRecord && (
                <VerificationModal
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                    onMarkPaid={markAsPaid}
                />
            )}
        </div>
    );
}

interface GameRecordCardProps {
    record: GameRecord;
    onVerify: () => void;
}

function GameRecordCard({ record, onVerify }: GameRecordCardProps) {
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">{record.player_emoji}</span>
                    <div>
                        <p className="font-black text-gray-900 text-lg">{record.player_name}</p>
                        <p className="text-xs text-gray-500">
                            Pantalla {record.screen_number} · {record.wheel_name}
                        </p>
                        {record.player_id && (
                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">
                                AUTENTICADO
                            </span>
                        )}
                    </div>
                </div>
                <span className="text-xs text-gray-400">
                    {formatDate(record.created_at)}
                </span>
            </div>

            {/* Selección */}
            <div className="flex gap-2 mb-3 items-center">
                <span className="text-xs text-gray-500 font-bold">Seleccionó:</span>
                {record.selected_animals?.map(id => {
                    const animal = ANIMAL_LIST.find(a => a.id === id);
                    return (
                        <div key={id} className="flex flex-col items-center">
                            <span className="text-2xl">{animal?.emoji}</span>
                            <span className="text-[9px] text-gray-400">{animal?.name}</span>
                        </div>
                    );
                })}
            </div>

            {/* Premio */}
            {record.prize_won ? (
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <div>
                        <p className="text-sm font-bold text-green-600 mb-1">
                            🏆 {record.prize_won}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${record.prize_payout_status === 'paid'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {record.prize_payout_status === 'paid' ? '✅ Pagado' : '⏳ Pendiente'}
                        </span>
                    </div>
                    {record.prize_payout_status !== 'paid' && (
                        <button
                            onClick={onVerify}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-sm transition-all"
                        >
                            Verificar
                        </button>
                    )}
                </div>
            ) : (
                <p className="text-sm text-gray-500 pt-3 border-t border-gray-100">❌ Sin premio</p>
            )}
        </div>
    );
}

interface VerificationModalProps {
    record: GameRecord;
    onClose: () => void;
    onMarkPaid: (recordId: string) => void;
}

function VerificationModal({ record, onClose, onMarkPaid }: VerificationModalProps) {
    const [revealed, setRevealed] = useState(false);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const winningAnimal = ANIMAL_LIST.find(a => a.id === record.spin_result);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-black mb-6 text-gray-900">🔍 Verificar Identidad</h2>

                {/* Info del jugador */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-1">Jugador</p>
                    <p className="text-2xl font-black text-gray-900">
                        {record.player_emoji} {record.player_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        Pantalla {record.screen_number} · {record.wheel_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {formatDate(record.created_at)}
                    </p>
                </div>

                {/* Selección */}
                <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-3 font-bold">Seleccionó:</p>
                    <div className="flex gap-4 justify-center">
                        {record.selected_animals?.map(id => {
                            const animal = ANIMAL_LIST.find(a => a.id === id);
                            return (
                                <div key={id} className="text-center">
                                    <span className="text-4xl block mb-1">{animal?.emoji}</span>
                                    <span className="text-xs text-gray-600 font-medium">{animal?.name}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Pregunta */}
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
                    <p className="text-sm font-bold text-yellow-800 mb-2">
                        ❓ Pregunta al jugador:
                    </p>
                    <p className="text-lg font-black text-yellow-900">
                        "¿Con cuál animal ganaste?"
                    </p>
                </div>

                {/* Revelar */}
                {!revealed ? (
                    <button
                        onClick={() => setRevealed(true)}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 mb-4 transition-all"
                    >
                        REVELAR RESPUESTA
                    </button>
                ) : (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-6">
                        <p className="text-sm font-bold text-green-800 mb-3 text-center">
                            ✅ Respuesta correcta:
                        </p>
                        <div className="text-center">
                            <span className="text-6xl block mb-2">
                                {winningAnimal?.emoji}
                            </span>
                            <p className="text-xl font-black text-green-900">
                                {winningAnimal?.name}
                            </p>
                        </div>
                    </div>
                )}

                {/* Premio */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-1">Premio</p>
                    <p className="text-xl font-black text-green-600">
                        🏆 {record.prize_won}
                    </p>
                </div>

                {/* Acciones */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50 transition-all"
                    >
                        Cancelar
                    </button>
                    {revealed && record.prize_payout_status !== 'paid' && (
                        <button
                            onClick={() => {
                                onMarkPaid(record.id);
                                onClose();
                            }}
                            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all"
                        >
                            ✅ Marcar como Pagado
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
