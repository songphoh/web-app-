
import React from 'react';
import { HistoryItem } from '../types';
import { Play, Sparkles, LayoutGrid, Plus } from 'lucide-react';

interface DashboardProps {
  history: HistoryItem[];
  onPlay: (item: HistoryItem) => void;
  onCreateNew: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ history, onPlay, onCreateNew }) => {
  return (
    <div className="w-full animate-fade-in p-8 md:p-12 space-y-10">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
            <h3 className="text-2xl font-black text-white flex items-center gap-3"><LayoutGrid className="text-indigo-500" /> คลังนิทานไวรัล</h3>
            <p className="text-slate-400 text-sm">รวมผลงานทั้งหมดที่คุณเนรมิตขึ้นมา</p>
        </div>
        <button onClick={onCreateNew} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-bold transition border border-slate-700"><Plus size={20} /> สร้างใหม่</button>
      </div>

      {history.length === 0 ? (
          <div className="text-center py-32 bg-slate-800/10 border border-slate-800 border-dashed rounded-[3.5rem]">
              <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-600"><Sparkles size={32} /></div>
              <h4 className="text-xl font-bold text-white mb-2">ยังไม่มีนิทานในคลัง</h4>
              <p className="text-slate-500 mb-10 max-w-xs mx-auto text-sm leading-relaxed">ลองสร้างเรื่องแรก เพื่อดูความมหัศจรรย์ของ AI</p>
              <button onClick={onCreateNew} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition shadow-2xl shadow-indigo-600/30">เริ่มเนรมิตเรื่องแรก</button>
          </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {history.map((item) => (
                  <div key={item.storyData.id} className="group bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 rounded-[2.5rem] overflow-hidden transition-all hover:shadow-2xl flex flex-col cursor-pointer" onClick={() => onPlay(item)}>
                      <div className="relative aspect-[9/16] overflow-hidden">
                          <img src={item.storyData.thumbnailUrl || item.media[0].imageUrl} alt={item.storyData.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100"></div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                              <div className="p-5 bg-white text-black rounded-full shadow-2xl"><Play size={28} fill="currentColor" /></div>
                          </div>
                          <div className="absolute bottom-6 left-6 right-6 space-y-2">
                              <div className="flex gap-2">
                                  <span className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-lg">VIRAL</span>
                                  <span className="px-3 py-1 bg-slate-800 text-slate-300 text-[9px] font-black uppercase rounded-lg">{item.storyData.mood}</span>
                              </div>
                              <h4 className="text-white font-black text-xl line-clamp-2 leading-tight drop-shadow-lg">{item.storyData.title}</h4>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};

export default Dashboard;
