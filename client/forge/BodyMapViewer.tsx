export function BodyMapViewer({ bodyMap }: { bodyMap: Record<string, { pain: number }> }) {
  if (!bodyMap) return null;

  return (
    <div className="p-2 border border-gray-700 rounded bg-black">
      <h3 className="text-xs mb-2 text-gray-400 uppercase tracking-tighter">Body Schema</h3>
      <div className="flex flex-col items-center space-y-1">
        <div
          className="w-8 h-8 rounded-full border border-gray-600 flex items-center justify-center text-[10px]"
          style={{ backgroundColor: `rgba(255, 0, 0, ${(bodyMap.head?.pain ?? 0) / 100})` }}
        >
          HEAD
        </div>
        <div
          className="w-12 h-16 border border-gray-600 flex items-center justify-center text-[10px]"
          style={{ backgroundColor: `rgba(255, 0, 0, ${(bodyMap.torso?.pain ?? 0) / 100})` }}
        >
          TORSO
        </div>
        <div className="flex space-x-1">
          <div
            className="w-4 h-12 border border-gray-600 text-[8px] flex items-center justify-center rotate-12"
            style={{ backgroundColor: `rgba(255, 0, 0, ${(bodyMap.leftLeg?.pain ?? 0) / 100})` }}
          >
            L-LEG
          </div>
          <div
            className="w-4 h-12 border border-gray-600 text-[8px] flex items-center justify-center -rotate-12"
            style={{ backgroundColor: `rgba(255, 0, 0, ${(bodyMap.rightLeg?.pain ?? 0) / 100})` }}
          >
            R-LEG
          </div>
        </div>
      </div>
    </div>
  );
}
