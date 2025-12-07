import React from 'react';
import { HistoryItem, StoryData } from '../types';
import { Play, FileText, Clock, TrendingUp, Sparkles, LayoutGrid, Calendar } from 'lucide-react';

interface DashboardProps {
  history: HistoryItem[];
  onPlay: (item: HistoryItem) => void;
  onCreateNew: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ history, onPlay, onCreateNew }) => {
  // Calculate Stats
  const totalStories = history.length;
  
  // Calculate most frequent mood
  const moodCounts = history.reduce((acc, item) => {
    const mood = item.storyData.mood || 'Unknown';
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topMood = Object.entries(moodCounts).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0] || '-';

  return (
    <div className="w-full h-full overflow-y-auto p-6 md:p-10 animate-fade-in">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
            <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
            <p className="text-slate-400">ภาพรวมการสร้างนิทานของคุณ</p>
        </div>
        <button 
            onClick={onCreateNew}
            className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition"
        >
            <Sparkles size={18} />
            สร้างเรื่องใหม่
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4">
            <div className="p-4 bg-indigo-500/20 rounded-full text-indigo-400">
                <FileText size={24} />
            </div>
            <div>
                <p className="text-slate-400 text-sm">นิทานทั้งหมด</p>
                <h3 className="text-3xl font-bold text-white">{totalStories}</h3>
            </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4">
            <div className="p-4 bg-pink-500/20 rounded-full text-pink-400">
                <TrendingUp size={24} />
            </div>
            <div>
                <p className="text-slate-400 text-sm">สไตล์ยอดนิยม</p>
                <h3 className="text-3xl font-bold text-white">{topMood}</h3>
            </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4">
            <div className="p-4 bg-green-500/20 rounded-full text-green-400">
                <Clock size={24} />
            </div>
            <div>
                <p className="text-slate-400 text-sm">เวลาที่ประหยัดได้</p>
                <h3 className="text-3xl font-bold text-white">{totalStories * 30} <span className="text-sm font-normal text-slate-500">นาที</span></h3>
            </div>
        </div>
      </div>

      {/* History Section */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <LayoutGrid size={20} className="text-indigo-400"/> ผลงานล่าสุด
        </h3>

        {history.length === 0 ? (
            <div className="text-center py-20 bg-slate-800/30 border border-slate-700 border-dashed rounded-2xl">
                <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="text-slate-500" />
                </div>
                <h4 className="text-lg font-medium text-white mb-2">ยังไม่มีนิทาน</h4>
                <p className="text-slate-400 mb-6">เริ่มสร้างนิทานเรื่องแรกของคุณเลย!</p>
                <button 
                    onClick={onCreateNew}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                >
                    สร้างนิทาน
                </button>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {history.map((item) => (
                    <div key={item.storyData.id} className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col">
                        {/* Thumbnail */}
                        <div className="relative aspect-video overflow-hidden">
                            <img 
                                src={item.media[0].imageUrl} 
                                alt={item.storyData.title} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <button 
                                    onClick={() => onPlay(item)}
                                    className="p-3 bg-white text-black rounded-full hover:scale-110 transition"
                                >
                                    <Play size={20} fill="currentColor" />
                                </button>
                            </div>
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-white">
                                {item.storyData.mood}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 flex-1 flex flex-col">
                            <div className="flex-1">
                                <h4 className="text-white font-bold line-clamp-1 mb-1">{item.storyData.title}</h4>
                                <p className="text-slate-500 text-xs line-clamp-2 mb-3">{item.storyData.seoSummary}</p>
                            </div>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-slate-800 mt-2">
                                <div className="flex items-center gap-1 text-slate-500 text-xs">
                                    <Calendar size={12} />
                                    <span>{new Date(item.storyData.createdAt).toLocaleDateString('th-TH')}</span>
                                </div>
                                <div className="flex gap-1">
                                    {item.storyData.tags?.slice(0, 2).map(tag => (
                                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;