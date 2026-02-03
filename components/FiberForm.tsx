
import React, { useState, useEffect } from 'react';
import { InstallationRecord, JobStatus, FiberReady, UserProfile } from '../types';
import MapPicker from './MapPicker';
import { parseWhatsAppMessage, generateWhatsAppLink } from '../services/utils';
import { Save, Phone, X, Upload, ShieldCheck } from 'lucide-react';

interface FiberFormProps {
  initialData?: InstallationRecord | null;
  onSave: (data: Partial<InstallationRecord>, method: 'save' | 'whatsapp') => void;
  onCancel: () => void;
  userProfile: UserProfile | null;
}

const emptyRecord: Partial<InstallationRecord> = {
  Title: '', Name: '', Contact: '', AltContact: '', Email: '', IdNo: '',
  RoadName: '', Address: '', FloorNo: '', House: '', FAT: '',
  coordinates: '', fiberReady: '', JobStatus: 'Pending',
  AccountNumber: '', DSR: '', DSRContacts: '', Team: '', Comment: ''
};

const FiberForm: React.FC<FiberFormProps> = ({ initialData, onSave, onCancel, userProfile }) => {
  const [formData, setFormData] = useState<Partial<InstallationRecord>>(emptyRecord);
  const [importText, setImportText] = useState('');
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importDraft, setImportDraft] = useState<Partial<InstallationRecord>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // It's a NEW record, auto-fill from Profile
      setFormData({
        ...emptyRecord,
        DSR: userProfile?.displayName || '',
        DSRContacts: userProfile?.phoneNumber || '',
        Team: userProfile?.team || ''
      });
    }
  }, [initialData, userProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMapSelect = (lat: number, lng: number, roadName?: string, area?: string) => {
    setFormData(prev => ({
      ...prev,
      coordinates: `${lat.toFixed(6)},${lng.toFixed(6)}`,
      RoadName: roadName || prev.RoadName || '',
    }));
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const parsed = parseWhatsAppMessage(importText);
    
    // Merge parsed data with current form data for the draft
    const draft = { ...formData };
    (Object.keys(parsed) as Array<keyof InstallationRecord>).forEach(key => {
      if (parsed[key]) {
        // @ts-ignore
        draft[key] = parsed[key];
      }
    });

    setImportDraft(draft);
    setShowImportPreview(true);
  };

  const applyImport = () => {
    setFormData(importDraft);
    setShowImportPreview(false);
    setImportText('');
  };

  const handleSubmit = (e: React.FormEvent, method: 'save' | 'whatsapp') => {
    e.preventDefault();
    onSave(formData, method);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-700 mb-2">WhatsApp Import</h3>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder="Paste WhatsApp message here..."
          className="w-full p-3 border border-gray-300 rounded-lg text-sm mb-2 h-24 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button 
          type="button" 
          onClick={handleImport}
          className="flex items-center justify-center gap-2 w-full bg-emerald-500 text-white py-2 rounded-lg hover:bg-emerald-600 font-medium transition"
        >
          <Upload size={18} /> Parse Data
        </button>

        {showImportPreview && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <h4 className="font-bold text-indigo-900 mb-3">Review Import</h4>
            <div className="grid grid-cols-2 gap-2 mb-4 max-h-60 overflow-y-auto">
              {Object.entries(importDraft).map(([k, v]) => (
                 v ? (
                  <div key={k} className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">{k}</label>
                    <input 
                      value={v as string}
                      onChange={(e) => setImportDraft(prev => ({...prev, [k]: e.target.value}))}
                      className="w-full text-sm p-1 border rounded"
                    />
                  </div>
                 ) : null
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={applyImport} className="flex-1 bg-indigo-600 text-white py-2 rounded font-medium">Apply</button>
              <button onClick={() => setShowImportPreview(false)} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded font-medium">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'save')} className="bg-white p-5 rounded-xl shadow-lg border border-gray-100 space-y-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          {initialData ? '✏️ Edit Installation' : '📡 New Installation'}
        </h2>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="Title" placeholder="Title" value={formData.Title} onChange={handleChange} className="input-field" />
          <input name="Name" placeholder="Name *" required value={formData.Name} onChange={handleChange} className="input-field" />
          <input name="Contact" placeholder="Contact *" required pattern="^(\+?254|0)[17]\d{8}$" value={formData.Contact} onChange={handleChange} className="input-field" />
          <input name="AltContact" placeholder="Alt Contact" value={formData.AltContact} onChange={handleChange} className="input-field" />
          <input name="Email" placeholder="Email" type="email" value={formData.Email} onChange={handleChange} className="input-field" />
          <input name="IdNo" placeholder="ID Number" value={formData.IdNo} onChange={handleChange} className="input-field" />
        </div>

        {/* Location */}
        <div className="border-t border-b border-gray-100 py-4 space-y-4">
          <h4 className="font-semibold text-gray-600">Location Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <input name="RoadName" placeholder="Road Name" value={formData.RoadName} onChange={handleChange} className="input-field" />
             <input name="Address" placeholder="Address / Apartment" value={formData.Address} onChange={handleChange} className="input-field" />
             <input name="FloorNo" placeholder="Floor No" value={formData.FloorNo} onChange={handleChange} className="input-field" />
             <input name="House" placeholder="House No" value={formData.House} onChange={handleChange} className="input-field" />
             <input name="FAT" placeholder="FAT" value={formData.FAT} onChange={handleChange} className="input-field" />
          </div>
          <MapPicker coordinates={formData.coordinates || ''} onLocationSelect={handleMapSelect} />
        </div>

        {/* Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select name="fiberReady" required value={formData.fiberReady} onChange={handleChange} className="input-field">
            <option value="">Fiber Ready?</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
          <select name="JobStatus" value={formData.JobStatus} onChange={handleChange} className="input-field">
            <option value="Forwarded">Forwarded</option>
            <option value="Pending">Pending</option>
            <option value="Installed">Installed</option>
            <option value="Rejected">Rejected</option>
            <option value="Lead">Lead</option>
          </select>
        </div>
        
        {/* Office Use Section */}
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
           <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-1 mb-2">
             <ShieldCheck size={14}/> Office / Admin Use
           </h4>
           <div className="grid grid-cols-1 gap-4">
               <div className="relative">
                 <label className="text-[10px] text-gray-500 font-bold ml-1 uppercase">Account Number</label>
                 <input 
                    name="AccountNumber" 
                    placeholder="Enter Account Number" 
                    value={formData.AccountNumber} 
                    onChange={handleChange} 
                    className="input-field bg-white border-indigo-300 font-mono text-indigo-900 font-bold" 
                 />
               </div>
           </div>
        </div>

        {/* DSR Info - Auto Filled and Read Only if from profile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200 opacity-75">
           <div className="col-span-2 text-xs font-bold text-gray-500 uppercase tracking-wide">DSR Details (Auto-Filled)</div>
           <input 
             name="DSR" 
             placeholder="DSR Name" 
             value={formData.DSR} 
             onChange={handleChange} 
             className="input-field bg-gray-100" 
             readOnly={!!userProfile}
           />
           <input 
             name="DSRContacts" 
             placeholder="DSR Contacts" 
             value={formData.DSRContacts} 
             onChange={handleChange} 
             className="input-field bg-gray-100" 
             readOnly={!!userProfile}
           />
           <input 
             name="Team" 
             placeholder="Team" 
             value={formData.Team} 
             onChange={handleChange} 
             className="input-field bg-gray-100" 
             readOnly={!!userProfile}
           />
        </div>

        <textarea name="Comment" placeholder="Comments..." value={formData.Comment} onChange={handleChange} className="input-field h-20" />

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
            <Save size={20} /> Save Record
          </button>
          <button 
            type="button" 
            onClick={(e) => handleSubmit(e, 'whatsapp')}
            className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2"
          >
            <Phone size={20} /> Save & WhatsApp
          </button>
          {initialData && (
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 flex items-center justify-center gap-2"
            >
              <X size={20} /> Cancel
            </button>
          )}
        </div>
      </form>
      <style>{`
        .input-field {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-field:focus {
          border-color: #4F46E5;
          ring: 2px solid #e0e7ff;
        }
      `}</style>
    </div>
  );
};

export default FiberForm;
