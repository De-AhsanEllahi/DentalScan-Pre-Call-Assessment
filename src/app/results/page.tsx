import MessageSidebar from "@/components/MessageSidebar";

export default function ResultsPage() {
    return (
        <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center">
            <h1 className="text-2xl font-bold text-blue-400 mb-2">Scan Results</h1>
            <p className="text-zinc-400 text-sm">Your scan is being analyzed by AI...</p>

            <MessageSidebar
                threadId=""
                patientId="patient_001"
            />
        </main>
    );
}