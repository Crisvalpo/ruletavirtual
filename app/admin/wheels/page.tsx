import WheelUploader from '@/components/admin/WheelUploader';
import GlobalControlPanel from '@/components/admin/GlobalControlPanel';

export default function AdminWheelsPage() {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">🎰 Gestión de Ruletas Individuales</h1>

                <div className="grid gap-8">
                    <GlobalControlPanel />
                    <WheelUploader />

                    {/* Future: List of existing wheels */}
                    <div className="bg-white p-6 rounded-xl shadow">
                        <h3 className="text-xl font-semibold mb-4">Ruletas Existentes</h3>
                        <p className="text-gray-500">Próximamente: Lista de ruletas configuradas</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
