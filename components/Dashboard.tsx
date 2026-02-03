
import React, { useMemo, useEffect, useState } from 'react';
import { InstallationRecord, JobStatus, Announcement, DirectMessage, UserProfile } from '../types';
import { db } from '../firebase';
import { FixedSizeList as List } from 'react-window';
import { Edit2, Trash2, Search, Download, RefreshCw, Megaphone, Bell, Check, X, Reply, Send, UserCog, Filter, Trophy } from 'lucide-react';

interface DashboardProps {
  records: InstallationRecord[];
  currentUser: UserProfile | null;
  onEdit: (r: InstallationRecord) => void;
  onDelete: (id: string) => void;
  onSync: () => void;
  onExport: () => void;
  onNew: () => void;
}

const getStatusColor = (status: JobStatus) => {
  switch (status) {
    case 'Installed': return 'bg-emerald-100 text-emerald-700';
    case 'Rejected': return 'bg-red-100 text-red-700';
    case 'Pending': return 'bg-amber-100 text-amber-700';
    case 'Lead': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

// Virtualized Row defined OUTSIDE the component to prevent re-mounting on every render
const VirtualRow = ({ index, style, data }: any) => {
  const { records, onEdit, onDelete } = data;
  const r = records[index];
  if (!r) return null;
  
  return (
      <div style={style} className="border-b border-gray-100 hover:bg-indigo-50 transition-colors bg-white p-3 flex items-center justify-between group">
          <div className="flex-1 min-w-0 pr-4">
              <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-gray-900 truncate">{r.Name}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(r.JobStatus)}`}>
                    {r.JobStatus}
                  </span>
              </div>
              <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                  <span className="truncate max-w-[150px]">{r.RoadName || 'No Loc'}</span>
                  <span>•</span>
                  <span>{r.Contact}</span>
                  <span>•</span>
                  <span>{new Date(r.updatedAt).toLocaleDateString()}</span>
              </div>
          </div>
          <div className="flex gap-2">
              <button onClick={() => onEdit(r)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-200"><Edit2 size={16}/></button>
              <button onClick={() => onDelete(r.id)} className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-200"><Trash2 size={16}/></button>
          </div>
      </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ records, currentUser, onEdit, onDelete, onSync, onExport, onNew }) => {
  const [filter, setFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'All'>('All');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  
  // Messaging State
  const [replyTarget, setReplyTarget] = useState<DirectMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  
  // New Message to Supervisor State
  const [supervisor, setSupervisor] = useState<UserProfile | null>(null);
  const [isMessagingSupervisor, setIsMessagingSupervisor] = useState(false);
  const [supervisorMsgText, setSupervisorMsgText] = useState('');

  useEffect(() => {
    if (!currentUser?.team) return;

    // 1. Listen for announcements
    const unsubAnnounce = db.collection('announcements')
      .where('team', '==', currentUser.team)
      .onSnapshot(snap => {
        const data = snap.docs.map(d => ({id: d.id, ...d.data()} as Announcement));
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAnnouncements(data.slice(0, 1)); 
      }, err => console.log("Announce error", err));

    // 2. Listen for Private Messages
    let unsubMsg = () => {};
    if (currentUser?.uid) {
      unsubMsg = db.collection('messages')
        .where('recipientUid', '==', currentUser.uid)
        .where('read', '==', false)
        .limit(5)
        .onSnapshot(snap => {
          setMessages(snap.docs.map(d => ({id: d.id, ...d.data()} as DirectMessage)));
        }, err => console.log("Msg error", err));
    }

    // 3. Find My Supervisor
    let unsubSuper = () => {};
    if (currentUser?.team) {
       unsubSuper = db.collection('users')
         .where('team', '==', currentUser.team)
         .where('role', '==', 'supervisor')
         .limit(1)
         .onSnapshot(snap => {
           if (!snap.empty) {
             setSupervisor(snap.docs[0].data() as UserProfile);
           }
         }, err => console.log("Supervisor lookup error", err));
    }

    return () => { unsubAnnounce(); unsubMsg(); unsubSuper(); };
  }, [currentUser]);

  const markMessageRead = async (id: string) => {
    try {
      await db.collection('messages').doc(id).update({ read: true });
    } catch (e) { console.error("Error marking read", e); }
  };

  const handleSendReply = async () => {
    if (!replyTarget || !currentUser || !replyText.trim()) return;
    try {
      await db.collection('messages').add({
        recipientUid: replyTarget.senderUid,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        content: replyText,
        read: false,
        createdAt: new Date().toISOString()
      });
      await markMessageRead(replyTarget.id);
      setReplyTarget(null);
      setReplyText('');
      alert("Reply sent successfully.");
    } catch (e) {
      alert("Failed to send reply.");
    }
  };

  const handleSendToSupervisor = async () => {
    if (!supervisor || !currentUser || !supervisorMsgText.trim()) return;
    try {
      await db.collection('messages').add({
        recipientUid: supervisor.uid,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        content: supervisorMsgText,
        read: false,
        createdAt: new Date().toISOString()
      });
      setIsMessagingSupervisor(false);
      setSupervisorMsgText('');
      alert("Message sent to Supervisor.");
    } catch (e) {
      alert("Failed to send.");
    }
  }

  const stats = useMemo(() => {
    return {
      pending: records.filter(r => r.JobStatus === 'Pending').length,
      installed: records.filter(r => r.JobStatus === 'Installed').length,
      rejected: records.filter(r => r.JobStatus === 'Rejected').length,
      lead: records.filter(r => r.JobStatus === 'Lead').length,
      total: records.length
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = filter.toLowerCase();
    return records
      .filter(r => statusFilter === 'All' || r.JobStatus === statusFilter)
      .filter(r => 
        r.Name.toLowerCase().includes(q) || 
        r.Contact.includes(q) || 
        (r.RoadName && r.RoadName.toLowerCase().includes(q))
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [records, filter, statusFilter]);

  return (
    <div className="space-y-6 pb-20 relative h-[calc(100vh-140px)] flex flex-col">
      
      {/* Scrollable Header Section */}
      <div className="flex-none space-y-6">
        {/* Messages & Announcements */}
        {messages.length > 0 && (
            <div className="space-y-2">
            {messages.map(msg => (
                <div key={msg.id} className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg flex flex-col gap-3 animate-fade-in">
                <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                    <Bell size={20} className="text-white mt-1" />
                    <div>
                        <h4 className="font-bold text-sm">Message from {msg.senderName || 'Supervisor'}</h4>
                        <p className="text-indigo-100 text-sm mt-1">{msg.content}</p>
                    </div>
                    </div>
                    <button onClick={() => markMessageRead(msg.id)} className="text-indigo-200 hover:text-white"><X size={16} /></button>
                </div>
                <div className="flex justify-end">
                    <button onClick={() => setReplyTarget(msg)} className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Reply size={12} /> Reply
                    </button>
                </div>
                </div>
            ))}
            </div>
        )}

        {announcements.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 items-start">
            <Megaphone size={20} className="text-amber-600 mt-1" />
            <div>
                <h4 className="font-bold text-amber-900 text-sm">{announcements[0].title}</h4>
                <p className="text-amber-800 text-sm">{announcements[0].content}</p>
            </div>
            </div>
        )}

        {/* CLICKABLE STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatBox label="Pending" value={stats.pending} color="bg-amber-500" active={statusFilter === 'Pending'} onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')} />
            <StatBox label="Lead" value={stats.lead} color="bg-blue-500" active={statusFilter === 'Lead'} onClick={() => setStatusFilter(statusFilter === 'Lead' ? 'All' : 'Lead')} />
            <StatBox label="Installed" value={stats.installed} color="bg-emerald-500" active={statusFilter === 'Installed'} onClick={() => setStatusFilter(statusFilter === 'Installed' ? 'All' : 'Installed')} />
            <StatBox label="Rejected" value={stats.rejected} color="bg-red-500" active={statusFilter === 'Rejected'} onClick={() => setStatusFilter(statusFilter === 'Rejected' ? 'All' : 'Rejected')} />
            <StatBox label="Total All" value={stats.total} color="bg-indigo-600" active={statusFilter === 'All'} onClick={() => setStatusFilter('All')} />
        </div>

        {/* Action Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
            <div className="relative flex-grow min-w-[150px]">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
                className="w-full pl-10 p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Search..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />
            </div>
            <button onClick={onNew} className="bg-indigo-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-indigo-700 flex-1 md:flex-none">
            + New
            </button>
            <button onClick={onExport} className="bg-emerald-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-emerald-700 flex-1 md:flex-none flex items-center justify-center gap-2">
            <Download size={18} /> CSV
            </button>
            {supervisor && (
            <button onClick={() => setIsMessagingSupervisor(true)} className="bg-indigo-50 text-indigo-700 border border-indigo-200 py-2 px-4 rounded-lg font-bold flex-1 md:flex-none flex items-center justify-center gap-2">
                <UserCog size={18} /> Super
            </button>
            )}
        </div>
      </div>

      {/* VIRTUALIZED LIST VIEW */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
        <List
            height={500} 
            itemCount={filteredRecords.length}
            itemSize={80} // Height of card row
            width={'100%'}
            itemData={{ records: filteredRecords, onEdit, onDelete }}
            className="virtual-list"
        >
            {VirtualRow}
        </List>
        
        {filteredRecords.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            No records found.
          </div>
        )}
      </div>

      {/* Reply/Message Modal */}
      {(replyTarget || isMessagingSupervisor) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="bg-indigo-900 text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="font-bold">
                  {replyTarget ? `Reply to ${replyTarget.senderName}` : `Message ${supervisor?.displayName}`}
              </h3>
              <button onClick={() => { setReplyTarget(null); setIsMessagingSupervisor(false); }} className="text-indigo-200 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4 space-y-4">
              <textarea 
                className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                placeholder="Type your message..."
                value={replyTarget ? replyText : supervisorMsgText}
                onChange={e => replyTarget ? setReplyText(e.target.value) : setSupervisorMsgText(e.target.value)}
              />
              <button 
                onClick={replyTarget ? handleSendReply : handleSendToSupervisor}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Send size={18} /> Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatBox = ({ label, value, color, active, onClick }: { label: string, value: number, color: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`${active ? color + ' ring-4 ring-offset-2 ring-indigo-200' : 'bg-white border border-gray-200 hover:bg-gray-50'} ${active ? 'text-white' : 'text-gray-600'} transition-all p-3 rounded-xl text-center shadow-sm flex flex-col items-center justify-center`}
  >
    <div className={`text-2xl font-bold ${!active && 'text-gray-800'}`}>{value}</div>
    <div className={`text-[10px] font-bold uppercase tracking-wider ${!active && 'text-gray-400'}`}>{label}</div>
  </button>
);

export default Dashboard;
