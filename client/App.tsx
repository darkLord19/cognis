export default function App() {
  return (
    <div className="flex h-screen bg-gray-900 text-white font-mono">
      <div className="w-64 border-r border-gray-700 p-4">
        <h1 className="text-xl font-bold mb-4">COGNIS FORGE</h1>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-64 border-b border-gray-700 p-4">
          <h2 className="text-sm border-b border-gray-700 mb-2">WORLD VISUALIZER</h2>
        </div>
        <div className="flex-1 p-4 grid grid-cols-2 gap-4">
          <div className="border border-gray-700 p-2">
            <h2 className="text-sm border-b border-gray-700 mb-2">AGENT INSPECTOR</h2>
          </div>
          <div className="border border-gray-700 p-2">
            <h2 className="text-sm border-b border-gray-700 mb-2">MERKLE AUDIT</h2>
          </div>
        </div>
      </div>
    </div>
  );
}
