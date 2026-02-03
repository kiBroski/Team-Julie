
import { InstallationRecord } from "../types";

export const generateId = (): string => crypto.randomUUID();

export const normalizeText = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[*_]/g, '')
    .replace(/[^a-z0-9:+.,\s]/g, '')
    .trim();
};

export const parseWhatsAppMessage = (text: string): Partial<InstallationRecord> => {
  const raw = normalizeText(text);
  const lines = text.split('\n');
  const result: Partial<InstallationRecord> = {};

  const fieldMap: Record<string, keyof InstallationRecord> = {
    'title': 'Title',
    'name': 'Name',
    'contact': 'Contact',
    'alt contact': 'AltContact',
    'email': 'Email',
    'email address': 'Email',
    'id no': 'IdNo',
    'id number': 'IdNo',
    'road name': 'RoadName',
    'address': 'Address',
    'address/apt name': 'Address',
    'floor no': 'FloorNo',
    'house': 'House',
    'fat': 'FAT',
    'coordinates': 'coordinates',
    'fiber ready': 'fiberReady',
    'job status': 'JobStatus',
    'dsr': 'DSR',
    'dsr contacts': 'DSRContacts',
    'team': 'Team',
    'comment': 'Comment'
  };

  const sortedKeys = Object.keys(fieldMap).sort((a, b) => b.length - a.length);

  // 1. Label-based parsing
  lines.forEach(line => {
    const colon = line.indexOf(':');
    if (colon === -1) return;

    let label = line.substring(0, colon).toLowerCase().trim();
    let value = line.substring(colon + 1).trim();

    label = label.replace(/\*/g, '').replace(/\s+/g, ' ');
    value = value.replace(/\*/g, '').trim();

    for (const key of sortedKeys) {
      if (label === key || label.includes(key)) {
        const field = fieldMap[key];
        if (value && value !== 'N/A') {
          // @ts-ignore - dynamic assignment
          result[field] = value;
        }
        break;
      }
    }
  });

  // 2. Pattern-based fallback
  const patterns: Record<string, RegExp> = {
    Contact: /(\+254|0)[17]\d{8}/,
    Email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    coordinates: /-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+/,
    IdNo: /\b\d{6,9}\b/
  };

  Object.entries(patterns).forEach(([key, regex]) => {
    const k = key as keyof InstallationRecord;
    if (!result[k]) {
      const match = raw.match(regex);
      if (match) {
        // @ts-ignore
        result[k] = match[0];
      }
    }
  });

  return result;
};

export const exportToCSV = (records: InstallationRecord[]) => {
  if (records.length === 0) return;

  // Specific Column Order requested by User
  const columns = [
    { header: 'Date', key: 'updatedAt', fmt: (v: string) => new Date(v).toLocaleDateString() + ' ' + new Date(v).toLocaleTimeString() },
    { header: 'Title', key: 'Title' },
    { header: 'Name', key: 'Name' },
    { header: 'Contact', key: 'Contact' },
    { header: 'Alt Contact', key: 'AltContact' },
    { header: 'Email', key: 'Email' },
    { header: 'Road Name', key: 'RoadName' },
    { header: 'Coordinates', key: 'coordinates' },
    { header: 'Address/Apt', key: 'Address' },
    { header: 'FAT', key: 'FAT' },
    { header: 'Status', key: 'JobStatus' },
    { header: 'Agent Name', key: 'DSR' },
    { header: 'Agent Contact', key: 'DSRContacts' },
    { header: 'Team', key: 'Team' },
    { header: 'Comment', key: 'Comment' }
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Escape quotes and wrap in quotes if it contains comma, quote or newline to prevent "jumbled" Excel rows
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = columns.map(c => c.header).join(',');
  
  const rows = records.map(record => {
    return columns.map(col => {
      // @ts-ignore
      let val = record[col.key];
      if (col.fmt) val = col.fmt(val);
      return escapeCsv(val);
    }).join(',');
  });

  const csvContent = [headerRow, ...rows].join('\n');
  
  // Add Byte Order Mark (BOM) for Excel UTF-8 compatibility so special chars display correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `FiberTrack_Export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateWhatsAppLink = (r: InstallationRecord) => {
  const val = (x: any) => (x ?? '');
  let msg = '';
  msg += `Title: ${val(r.Title)}\n`;
  msg += `*Name:* ${val(r.Name)}\n`;
  msg += `*Contact:* ${val(r.Contact)}\n`;
  msg += `Alt Contact: ${val(r.AltContact)}\n`;
  msg += `*Email:* ${val(r.Email)}\n`;
  msg += `ID: ${val(r.IdNo)}\n`;
  msg += `*Road:* ${val(r.RoadName)}\n`;
  msg += `*Address:* ${val(r.Address)}\n`;
  msg += `*Floor:* ${val(r.FloorNo)}\n`;
  msg += `*House:* ${val(r.House)}\n`;
  msg += `*FAT:* ${val(r.FAT)}\n`;
  msg += `*Coordinates:* ${val(r.coordinates)}\n`;
  msg += `*Fiber Ready:* ${val(r.fiberReady)}\n\n`;
  msg += `*DSR:* ${val(r.DSR)}\n`;
  msg += `*DSR Contact:* ${val(r.DSRContacts)}\n`;
  msg += `*Team:* ${val(r.Team)}\n`;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
};
