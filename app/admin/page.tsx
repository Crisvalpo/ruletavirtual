import ScreenControlDashboard from '@/components/admin/ScreenControlDashboard';
import Link from 'next/link';

export default function AdminDashboardPage() {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">📊 Admin Dashboard</h1>
                    <div className="flex gap-4">
                        <Link href="/" className="text-gray-500 hover:text-gray-900 font-medium">
                            ← Volver al Inicio
                        </Link>
                        <Link href="/admin/wheels" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                            ⚙️ Gestionar Ruletas
                        </Link>
                    </div>
                </header>

                {/* Monitors */}
                <ScreenControlDashboard />

                {/* Other Stats could go here */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-white p-6 rounded-xl shadow opacity-50">
                        <h3 className="font-bold text-gray-500 mb-2">Estadísticas (Próximamente)</h3>
                        <p className="text-3xl font-black text-gray-300">0</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
