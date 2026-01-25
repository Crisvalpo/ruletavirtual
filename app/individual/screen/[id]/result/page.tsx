export default async function ResultPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
            {/* Estado: Ganador (Ejemplo) */}
            <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h1 className="text-4xl font-bold text-yellow-400 mb-2">¡GANASTE!</h1>
                <p className="text-xl mb-8">La ruleta cayó en tu animal</p>

                <div className="bg-white text-gray-900 p-6 rounded-xl mb-8 transform rotate-2">
                    <p className="font-bold text-lg">PREMIO</p>
                    <p className="text-4xl font-black text-green-600">$5,000</p>
                </div>

                <div className="bg-white p-4 rounded-lg inline-block">
                    {/* QR Code Placeholder */}
                    <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                        QR CODE PREMIO
                    </div>
                </div>

                <p className="mt-4 text-sm text-gray-400">
                    Muestra este código al staff
                </p>

                <button className="mt-8 bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-full font-bold">
                    Jugar de Nuevo
                </button>
            </div>
        </div>
    );
}
